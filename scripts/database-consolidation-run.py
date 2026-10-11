"""Guarded, private-network staging consolidation. No credentials enter logs."""
import copy
import datetime as dt
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import traceback
from urllib.parse import quote, urlsplit, unquote
from urllib.request import urlopen
import importlib.util

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('consolidate-staging-database.py'))
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)
az = audit.az
SUB = '8db29c6a-b3f5-4e02-919f-3ea5b3cab71e'
PROD = 'rg-commerce-production-au'; STAGE = 'rg-tapkin-staging-au'
APP = 'app-tapkin-staging-au'; MIG = 'job-tapkin-staging-migrate'; ORDERS = APP + '-orders'
PG = 'pg-tapkin-staging-vnet-au'; TARGET = 'pg-tapkin-production-vnet-au'
SOURCE_HOST = PG + '.postgres.database.azure.com'; TARGET_HOST = TARGET + '.postgres.database.azure.com'
SECRET = 'database-url-consolidated-staging'; ROLE = 'tapkin_staging_app'
STORAGE = 'stcommerceproductionau'; CONTAINER = 'staging-db-consolidation'; JOB = 'job-staging-db-consolidation'
ZONE = 'staging-commerce.postgres.database.azure.com'; TARGET_ZONE = 'commerce-production.postgres.database.azure.com'
STATE = None


def show(kind, name, group=STAGE):
    return az('containerapp', *(['job'] if kind == 'job' else []), 'show', '-n', name, '-g', group)


def secret_values(kind, name, group=STAGE):
    result = az('containerapp', *(['job'] if kind == 'job' else []), 'secret', 'list', '-n', name, '-g', group, '--show-values')
    return {item['name']: item.get('value') for item in result}


def env_values(resource):
    return {e['name']: e for c in resource['properties']['template']['containers'] for e in c.get('env', [])}


def db_url(kind, name, group=STAGE):
    resource = show(kind, name, group); value = env_values(resource)['DATABASE_URL']
    return value.get('value') or secret_values(kind, name, group)[value['secretRef']]


def guard_url(value, host, database):
    p = urlsplit(value)
    if p.scheme not in ('postgres', 'postgresql') or p.hostname != host or unquote(p.path[1:]) != database or not p.username or not p.password:
        raise RuntimeError('Unexpected database connection; refusing migration')
    return p


def put_resource(resource, properties):
    # A mode-0600 file prevents credentials appearing in the command or logs.
    properties = copy.deepcopy(properties)
    entries = properties.get('configuration', {}).get('secrets', [])
    missing = [x for x in entries if 'value' not in x and not x.get('keyVaultUrl')]
    if missing:
        kind = 'job' if '/jobs/' in resource['id'] else 'app'
        group = resource['id'].split('/')[4]
        values = secret_values(kind, resource['id'].split('/')[-1], group)
        for entry in missing:
            if values.get(entry['name']) is None: raise RuntimeError('Cannot preserve an existing resource secret')
            entry['value'] = values[entry['name']]
    body = {'location':resource['location'], 'properties':properties}
    for key in ('identity','tags'):
        if key in resource: body[key] = resource[key]
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / 'resource.json'; path.write_text(json.dumps(body)); path.chmod(0o600)
        return az('rest', '--method', 'put', '--url', 'https://management.azure.com' + resource['id'] + '?api-version=2024-03-01', '--body', '@' + str(path))


def patch_resource(resource, properties):
    # Patch only the intended fields, preserving existing environment and identity links.
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'patch.json'
        path.write_text(json.dumps({'properties': properties})); path.chmod(0o600)
        return az('rest','--method','patch','--url','https://management.azure.com'+resource['id']+'?api-version=2024-03-01','--body','@'+str(path))


def update_env(kind, name, value):
    resource = show(kind, name)
    current_values=env_values(resource)
    if current_values.get('DATABASE_URL',{}).get('secretRef')==value:
        if kind=='app':return resource
        if current_values.get('DATABASE_EXPECTED_NAME',{}).get('value')=='tapkin_staging' and current_values.get('APP_ENV',{}).get('value')=='staging':return resource
    template = copy.deepcopy(resource['properties']['template'])
    if kind=='app':template['revisionSuffix']='db-'+secrets.token_hex(4)
    for container in template['containers']:
        if container.get('resources'):container['resources']={key:v for key,v in container['resources'].items() if key in ('cpu','memory','gpu')}
    for container in template['containers']:
        entries = {item['name']:item for item in container.get('env', [])}
        if 'DATABASE_URL' not in entries: continue
        entries['DATABASE_URL']={'name':'DATABASE_URL','secretRef':value}
        if kind=='job':
            entries['DATABASE_EXPECTED_NAME']={'name':'DATABASE_EXPECTED_NAME','value':'tapkin_staging'}
            entries['APP_ENV']={'name':'APP_ENV','value':'staging'}
        container['env']=list(entries.values())
    if kind=='app':
        az('containerapp','update','-n',name,'-g',STAGE,'--set-env-vars','DATABASE_URL=secretref:'+value,'--revision-suffix',template['revisionSuffix'])
    else:patch_resource(resource, {'template':template})
    for attempt in range(90):
        current = show(kind, name)
        if current['properties'].get('provisioningState') in ('Failed','Canceled'):
            raise RuntimeError('Database connection revision provisioning failed')
        if current['properties'].get('provisioningState')=='Succeeded' and env_values(current)['DATABASE_URL'].get('secretRef')==value:
            if kind=='job':return current
            latest=current['properties']['latestRevisionName']
            revision=next((r for r in revisions() if r['name']==latest),None)
            if revision and env_values(revision).get('DATABASE_URL',{}).get('secretRef')==value:return current
        time.sleep(5)
    raise RuntimeError('Timed out waiting for the database connection revision')


def set_secret(kind, name, value):
    resource = show(kind, name)
    props = copy.deepcopy(resource['properties'])
    current = secret_values(kind, name)
    current[SECRET] = value
    # Preserve Key Vault references and identities when present.
    config = props['configuration']; existing = {x['name']:x for x in config.get('secrets', [])}
    config['secrets'] = [{**existing.get(k, {'name': k}), **({'value':v} if v is not None else {})} for k,v in current.items()]
    patch_resource(resource, {'configuration': {'secrets': config['secrets']}})


def storage_args():
    return ['--account-name', STORAGE, '--auth-mode', 'login']


def blob_upload(name, data):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'blob'; p.write_bytes(data); p.chmod(0o600)
        az('storage', 'blob', 'upload', *storage_args(), '-c', CONTAINER, '-n', name, '-f', str(p), '--overwrite', 'true')


def blob_read(name):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'blob'
        az('storage', 'blob', 'download', *storage_args(), '-c', CONTAINER, '-n', name, '-f', str(p))
        return p.read_bytes()


def write_control(state): blob_upload('control.json', json.dumps(state).encode())


def revisions(): return az('containerapp', 'revision', 'list', '-n', APP, '-g', STAGE)


def health():
    for domain in ('staging.tapkin.com.au', 'staging.kosykin.com.au', 'tapkin.com.au', 'kosykin.com.au'):
        passed = False
        for attempt in range(30):
            try:
                with urlopen('https://' + domain + '/api/health/ready', timeout=30) as r:
                    payload = json.loads(r.read())
                    if r.status == 200: passed = True; break
            except Exception: pass
            time.sleep(5)
        if not passed: raise RuntimeError('Database readiness failed for ' + domain)
    print('All four storefront database readiness checks passed', flush=True)


def pause(state):
    worker = show('job', ORDERS)
    state['orderConfiguration'] = copy.deepcopy(worker['properties']['configuration'])
    state['activeRevisions'] = [r['name'] for r in revisions() if r['properties'].get('active')]
    write_control(state)
    props = copy.deepcopy(worker['properties']); config = props['configuration']
    config['triggerType'] = 'Manual'; config.pop('scheduleTriggerConfig', None)
    config['manualTriggerConfig'] = {'parallelism':1, 'replicaCompletionCount':1}
    patch_resource(worker, {'configuration': {'triggerType':'Manual','manualTriggerConfig':config['manualTriggerConfig'],'scheduleTriggerConfig':None,'eventTriggerConfig':None}})
    for name in (ORDERS, MIG):
        executions = az('containerapp', 'job', 'execution', 'list', '-n', name, '-g', STAGE)
        running = [e for e in executions if e['properties']['status'] in ('Running', 'Processing', 'Pending')]
        if name == MIG and running: raise RuntimeError('An existing staging schema migration is still running')
        for execution in running:
            az('containerapp', 'job', 'stop', '-n', name, '-g', STAGE, '--job-execution-name', execution['name'])
    for name in state['activeRevisions']:
        az('containerapp', 'revision', 'deactivate', '-n', APP, '-g', STAGE, '--revision', name)
    if any(r['properties'].get('active') for r in revisions()): raise RuntimeError('Staging revisions remain active')
    print('Staging writes paused; production remains online', flush=True)


def activate_revision(name):
    resource = show('app', APP)
    current=next((r for r in revisions() if r['name']==name),None)
    if current and current['properties'].get('active'):return current
    try:
        return az('rest','--method','post','--url','https://management.azure.com'+resource['id']+'/revisions/'+name+'/activate?api-version=2024-03-01')
    except RuntimeError as error:
        if 'RevisionAlreadyInRequestedState' not in str(error):raise
        current=next((r for r in revisions() if r['name']==name),None)
        if not current or not current['properties'].get('active'):raise
        return current


def recover_source(state):
    if not state or state.get('phase') not in ('prepared','copy-verified','rolled-back','recovered'):
        raise RuntimeError('Source recovery requires a recorded migration attempt')
    for kind,name,field in (('app',APP,'originalAppSecret'),('job',MIG,'originalMigrationSecret')):
        value = secret_values(kind,name)[state[field]]
        guard_url(value,SOURCE_HOST,'tapkin_staging')
        current = update_env(kind,name,state[field])
        if kind=='app':
            latest = current['properties']['latestRevisionName']
            active = [r for r in revisions() if r['properties'].get('active')]
            if not any(r['name']==latest for r in active):activate_revision(latest)
    if 'orderConfiguration' in state:restore_orders(state)
    health()
    state['phase']='recovered';write_control(state)
    print('Original staging database, active revision and configured order schedule recovered',flush=True)


def restore_orders(state):
    worker = show('job', ORDERS); props = copy.deepcopy(worker['properties'])
    # Keep credentials as existing secret refs; only restore trigger configuration.
    for key in ('triggerType','manualTriggerConfig','scheduleTriggerConfig','eventTriggerConfig'):
        props['configuration'].pop(key, None)
        if key in state['orderConfiguration']: props['configuration'][key] = state['orderConfiguration'][key]
    patch_resource(worker, {'configuration': {key: state['orderConfiguration'].get(key) for key in ('triggerType','manualTriggerConfig','scheduleTriggerConfig','eventTriggerConfig')}})


def network():
    prod = az('network', 'vnet', 'show', '-g', PROD, '-n', 'vnet-commerce-production-au')
    stage = az('network', 'vnet', 'show', '-g', STAGE, '-n', 'vnet-tapkin-staging-au')
    for a in prod['addressSpace']['addressPrefixes']:
        for b in stage['addressSpace']['addressPrefixes']:
            if ipaddress.ip_network(a).overlaps(ipaddress.ip_network(b)): raise RuntimeError('VNet ranges overlap')
    for group, local, remote, name in ((PROD,prod,stage,'staging-database'),(STAGE,stage,prod,'production-database')):
        existing = az('network', 'vnet', 'peering', 'list', '-g', group, '--vnet-name', local['name'])
        match = next((x for x in existing if x['name'] == name), None)
        if match and match['remoteVirtualNetwork']['id'].lower() != remote['id'].lower(): raise RuntimeError('Unexpected existing peering')
        if not match: az('network','vnet','peering','create','-g',group,'--vnet-name',local['name'],'-n',name,'--remote-vnet',remote['id'],'--allow-vnet-access')
    for group, zone, remote, name in ((PROD,TARGET_ZONE,stage,'link-staging-vnet'),(STAGE,ZONE,prod,'link-migration-production-vnet')):
        links = az('network','private-dns','link','vnet','list','-g',group,'-z',zone)
        match = next((x for x in links if x['name'] == name),None)
        if match and match['virtualNetwork']['id'].lower() != remote['id'].lower(): raise RuntimeError('Unexpected DNS link')
        if not match: az('network','private-dns','link','vnet','create','-g',group,'-z',zone,'-n',name,'-v',remote['id'],'--registration-enabled','false')
    print('Private peering and DNS prepared without public PostgreSQL access', flush=True)


def start_worker(mode, source, production, target, sas, backup):
    app = show('app','app-tapkin-production-au',PROD)
    prop = app['properties']; registry = next((r for r in prop['configuration'].get('registries', []) if r['server']=='ghcr.io'), None)
    registry_value = secret_values('app','app-tapkin-production-au',PROD)[registry['passwordSecretRef']] if registry else None
    env = {'MIGRATION_MODE':mode, 'STAGING_WRITES_PAUSED':str(mode in ('copy','copy-empty','copy-clone')).lower(), 'ALLOW_EMPTY_TARGET_RETRY':str(mode=='copy-empty').lower(), 'ALLOW_KNOWN_CLONE_RETRY':str(mode=='copy-clone').lower(), 'BACKUP_NAME':backup}
    secret_env = {'SOURCE_DATABASE_URL':source,'PRODUCTION_DATABASE_URL':production,'TARGET_DATABASE_URL':target,'BACKUP_CONTAINER_SAS':sas}
    if mode=='copy-clone':secret_env['EXPECTED_CLONE_MANIFEST']=json.dumps(STATE['manifest'],sort_keys=True)
    config = {'triggerType':'Manual','replicaTimeout':1800,'replicaRetryLimit':0,'manualTriggerConfig':{'parallelism':1,'replicaCompletionCount':1},
              'registries':[{'server':'ghcr.io','username':registry['username'],'passwordSecretRef':'registry-token'}] if registry else [],
              'secrets':([{'name':'registry-token','value':registry_value}] if registry else [])+[{'name':k.lower().replace('_','-'),'value':v} for k,v in secret_env.items()]}
    resource = {'id':'/subscriptions/'+SUB+'/resourceGroups/'+PROD+'/providers/Microsoft.App/jobs/'+JOB, 'location':'australiaeast'}
    props = {'environmentId':prop['environmentId'], 'configuration':config,'template':{'containers':[{'name':'copy','image':os.environ['CONSOLIDATION_IMAGE'],'resources':{'cpu':0.5,'memory':'1Gi'},
               'env':[{'name':k,'value':v} for k,v in env.items()]+[{'name':k,'secretRef':k.lower().replace('_','-')} for k in secret_env]}]}}
    put_resource(resource, props)
    for attempt in range(60):
        provisioning = show('job', JOB, PROD)['properties'].get('provisioningState')
        if provisioning == 'Succeeded': break
        if provisioning in ('Failed', 'Canceled'): raise RuntimeError('Migration job provisioning failed')
        time.sleep(5)
    else: raise RuntimeError('Migration job provisioning timed out')
    run = az('containerapp','job','start','-n',JOB,'-g',PROD)['name']
    print('Private migration worker started: '+mode, flush=True)
    for attempt in range(180):
        execution = az('containerapp','job','execution','show','-n',JOB,'-g',PROD,'--job-execution-name',run)
        status = execution['properties']['status']
        if status=='Succeeded': return json.loads(blob_read('status.json'))
        if status in ('Failed','Canceled','Cancelled'): raise RuntimeError('Private database worker failed in '+mode)
        time.sleep(10)
    raise RuntimeError('Private database worker timed out')


def retirement(state):
    if state.get('phase') != 'cutover-verified': raise RuntimeError('Retirement requires persisted verified cutover')
    for kind,name in (('app',APP),('job',MIG)):
        parsed = guard_url(db_url(kind,name),TARGET_HOST,'tapkin_staging')
        if unquote(parsed.username) != ROLE: raise RuntimeError('Staging must use restricted login')
    active = [r for r in revisions() if r['properties'].get('active')]
    if not active or any(env_values(r).get('DATABASE_URL',{}).get('secretRef')!=SECRET for r in active):
        raise RuntimeError('An active staging revision has an unverified database connection')
    for group in (PROD,STAGE):
        for kind in ('app','job'):
            resources = az('containerapp', *(['job'] if kind=='job' else []),'list','-g',group)
            for resource in resources:
                if resource['name']==JOB: continue
                values = env_values(resource)
                if 'DATABASE_URL' in values and urlsplit(db_url(kind,resource['name'],group)).hostname == SOURCE_HOST:
                    raise RuntimeError('A live resource still references the old server')
    data = blob_read(state['backup'])
    if hashlib.sha256(data).hexdigest()!=state['backupSha256']: raise RuntimeError('Durable backup hash mismatch')
    health()
    servers = az('postgres','flexible-server','list','-g',STAGE)
    source = next((s for s in servers if s['name']==PG),None)
    if source:
        if len(servers)!=1 or source['network']['publicNetworkAccess']!='Disabled' or not source['network']['delegatedSubnetResourceId'].endswith('/vnet-tapkin-staging-au/subnets/snet-postgres') or not source['network']['privateDnsZoneArmResourceId'].endswith('/'+ZONE):
            raise RuntimeError('Source resource ownership differs from audited server')
        state['phase']='retirement-started'; write_control(state)
        az('postgres','flexible-server','delete','-g',STAGE,'-n',PG,'--yes')
        print('Old staging PostgreSQL server deleted after verified cutover',flush=True)
    zones = az('network','private-dns','zone','list','-g',STAGE)
    if any(z['name']==ZONE for z in zones): az('network','private-dns','zone','delete','-g',STAGE,'-n',ZONE,'--yes')
    # Retain the staging VNet, Container Apps subnet, applications, jobs, storage and logs.
    subnets = az('network','vnet','subnet','list','-g',STAGE,'--vnet-name','vnet-tapkin-staging-au')
    subnet = next((s for s in subnets if s['name']=='snet-postgres'),None)
    if subnet and not subnet.get('ipConfigurations') and not subnet.get('serviceAssociationLinks'):
        az('network','vnet','subnet','delete','-g',STAGE,'--vnet-name','vnet-tapkin-staging-au','-n','snet-postgres')
    az('containerapp','job','delete','-n',JOB,'-g',PROD,'--yes')
    state['phase']='completed'; write_control(state)
    health()
    if any(s['name']==PG for s in az('postgres','flexible-server','list','-g',STAGE)): raise RuntimeError('Source server still exists')
    print('Consolidation complete; staging server absent and both environments healthy',flush=True)


def main():
    global STATE
    operation = os.environ['CONSOLIDATION_OPERATION']
    if operation=='audit': audit.audit(); return
    if operation not in ('migrate','retire','recover','resume'): raise RuntimeError('Unknown operation')
    # Use storage account keys only for a container-scoped short-lived SAS; never print them.
    key = az('storage','account','keys','list','-g',PROD,'-n',STORAGE)[0]['value']
    os.environ['AZURE_STORAGE_KEY']=key
    # Control plane Contributor does not imply data-plane RBAC. Account-key auth is scoped to this process.
    global storage_args
    storage_args = lambda: ['--account-name', STORAGE, '--auth-mode','key']
    az('storage','container','create',*storage_args(),'-n',CONTAINER,'--public-access','off')
    existing = az('storage','blob','exists',*storage_args(),'-c',CONTAINER,'-n','control.json')['exists']
    STATE=json.loads(blob_read('control.json')) if existing else None
    if operation=='recover': recover_source(STATE);return
    if operation=='retire':
        if STATE and STATE['phase']=='retirement-started': STATE['phase']='cutover-verified'
        retirement(STATE or {});return
    if STATE and STATE['phase'] in ('cutover-verified','retirement-started'):
        STATE['phase']='cutover-verified';retirement(STATE);return
    if STATE and STATE['phase']=='completed': health();print('Already completed');return
    resuming = operation=='resume'
    if resuming:
        if not STATE or STATE.get('phase') not in ('prepared','recovered','rolled-back'):raise RuntimeError('Resume requires a recorded source recovery or failed copy')
        recover_source(STATE)
    elif STATE: raise RuntimeError('Previous attempt exists; review source and destination before retry')
    source=db_url('job',MIG); production=db_url('app','app-tapkin-production-au',PROD)
    guard_url(source,SOURCE_HOST,'tapkin_staging'); prod_parsed=guard_url(production,TARGET_HOST,'tapkin_production')
    guard_url(db_url('app',APP),SOURCE_HOST,'tapkin_staging')
    if unquote(prod_parsed.username)!='tapkin_production_admin': raise RuntimeError('Unexpected production owner login')
    prod_job=guard_url(db_url('job','job-tapkin-production-migrate',PROD),TARGET_HOST,'tapkin_production')
    if prod_job.username!=prod_parsed.username: raise RuntimeError('Review production migration login before changing PUBLIC access')
    app=show('app',APP)
    if env_values(app).get('APP_ENV',{}).get('value')!='staging': raise RuntimeError('Application environment mismatch')
    target=secret_values('app',APP)[SECRET] if resuming else 'postgresql://'+ROLE+':'+quote(secrets.token_urlsafe(48),safe='')+'@'+TARGET_HOST+':5432/tapkin_staging?sslmode=require'
    if unquote(guard_url(target,TARGET_HOST,'tapkin_staging').username)!=ROLE:raise RuntimeError('Target login must remain restricted')
    network()
    expiry=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=3)).strftime('%Y-%m-%dT%H:%MZ')
    token=az('storage','container','generate-sas',*storage_args(),'-n',CONTAINER,'--permissions','racw','--expiry',expiry,'--https-only')
    sas='https://'+STORAGE+'.blob.core.windows.net/'+CONTAINER+'?'+token
    backup='staging-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.dump'
    start_worker('probe',source,production,target,sas,backup)
    if not resuming:set_secret('app',APP,target);set_secret('job',MIG,target)
    if resuming:
        STATE['previousBackup']=STATE['backup'];STATE['backup']=backup;STATE['phase']='prepared'
    else:STATE={'phase':'prepared','backup':backup,'originalAppSecret':env_values(app)['DATABASE_URL']['secretRef'],'originalMigrationSecret':env_values(show('job',MIG))['DATABASE_URL']['secretRef']}
    write_control(STATE)
    try:
        pause(STATE)
        result=start_worker(('copy-clone' if STATE.get('manifest') else 'copy-empty') if resuming else 'copy',source,production,target,sas,backup)
        if result['phase']!='copy-verified' or not result['stagingCannotAccessProduction']: raise RuntimeError('Copy verification missing')
        STATE.update(result);write_control(STATE)
        update_env('job',MIG,SECRET)
        updated=update_env('app',APP,SECRET)
        latest=updated['properties']['latestRevisionName']
        activate_revision(latest)
        health();restore_orders(STATE)
        STATE['phase']='cutover-verified';write_control(STATE)
    except Exception:
        # Restore the source connection on the current application image and revision.
        # Never deactivate a working source revision just to re-activate an older one.
        recover_source(STATE)
        raise

    retirement(STATE)


if __name__=='__main__':
    try: main()
    except Exception as exc:
        print('Consolidation halted: '+type(exc).__name__+'; inspect current phase before any deletion',flush=True)
        print('Safe failure locations: '+json.dumps([{'function':f.name,'line':f.lineno} for f in traceback.extract_tb(exc.__traceback__)]),flush=True)
        # Sanitized error generated by Azure helper contains code only, never raw provider response.
        if str(exc).startswith('Azure operation failed:'): print(str(exc),flush=True)
        elif type(exc) is RuntimeError: print(str(exc),flush=True)
        else: print('Guard or worker operation failed; no secrets were logged',flush=True)
        raise SystemExit(1)
