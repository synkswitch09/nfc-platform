# Website knowledge and customer replies

Website import is a reviewed snapshot, not a browser tool. Customer chat has no live
web search and no product/order action tools. Sources are reference material only.

## Import coverage

- Shared stores: published pages/categories and active shop-visible products only;
  existing discovery limits remain 50 pages, 50 categories and 100 products.
- External websites: up to 24 public pages within the existing 25-second deadline,
  respecting robots/noindex, same-origin navigation and pinned public network access.
- Knowledge storage grows from 30,000 to 200,000 characters in existing text fields.
  All readable sources receive a fair share before spare space is redistributed.
  A long policy cannot silently consume all space ahead of products.
- Snapshot metadata records import time, coverage, original/included source lengths
  and bounded discovery warnings. No stock, order, customer or integration secrets
  are imported. The larger bound is storage capacity, not a promise of full-site coverage.

## Reply context

`selectKnowledge` splits the snapshot into overlapping chunks and ranks them using
latest-question keywords, source titles and recent customer context. English/Spanish
intent aliases cover pickup, shipping, colours, pricing, size and other common topics.
This is deterministic lexical retrieval, not an embedding service or a new AI call.
At most 12,000 reference characters and two chunks per source are supplied to the model.
Greeting-only messages need no catalogue context. Manual knowledge and older snapshots
are supported. Old snapshots cannot recover information previously omitted: reimport.
Drafting and voice payloads use the same bound to avoid unexpectedly sending a newly
expanded 200,000-character catalogue to their providers.

Platform instructions require direct natural answers, useful product details, selective
links and honesty about unavailable browsing/actions. They do not guarantee model
compliance. Instagram receives generated text, not a separate homepage card; URL previews
are controlled by the channel. No message is sent by the audit/inspection UI.

## Owner inspection and update

Your assistant → What your assistant knows shows the exact published snapshot and saved
draft separately, import dates, source sections, partial-source warnings and old-limit
warnings. Inspect relevant information uses the same selector without AI credits. It is
an isolated question; recent conversation history can alter actual runtime selection.

To refresh existing content: Refresh website information → review source coverage →
Replace draft with this import → Save draft or Save & publish. Importing alone never
changes saved or published information. Private answer tests use the saved draft;
customer channels use published information. Reimporting replaces any manual additions,
so review and preserve owner corrections before publishing.

No migration, automatic overwrite of a business prompt, production configuration change,
AI call, outbound message or deployment is performed by this code change. The new runtime
selector takes effect when the application is deployed. Existing missing facts require
an owner-authorised refresh and publication in the deployed panel.
