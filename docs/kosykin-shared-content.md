# Shared content, launch gifts and verified reviews

Open **Storefront → Shared banners, gifts & reviews** in the selected store.

## Banners

Each group owns one ordered set of up to 20 slides. Home and Shop reference
that same group. Choose the Home insertion index and one of four Shop slots.
Other modular pages can reference a group from a CTA section's shared-group
selector; move that section in the page editor to choose its position.
An explicit Home section reference takes precedence over automatic placement,
so the same group is not injected twice.

Edit titles, descriptions, terms, colours, font treatments, uploaded artwork,
links, visibility and ordering in one place. Artwork uses the existing media
picker. Multiple active slides show manual previous/next controls and dots;
one slide has no misleading extra dots. Navigation supports keyboard arrows
and focus. There is no forced autoplay.

A slide linked to `launch-stands` is visible only while that campaign is active
and below its limit. Exhaustion removes only those slides, not unrelated offers.
Use `{limit}`, `{gift}` and `{category}` in linked copy. An empty linked slide URL
uses the eligible category's Shop URL. Independent slides require their own URL.

## Launch gift

The one-time Kosykin migration sets up a Wavy Mini Tray for the first **50
qualifying paid website orders** containing a product in `stands-holders`.
It starts with zero awards at activation; historical orders are not backfilled.
The eligible category, gift name and limit can be changed in the CMS.
If the expected category does not exist, no gift campaign is activated and its
banner stays hidden until an administrator selects the category and saves it.

Allocation runs inside serializable Stripe payment settlement. One qualifying
order gets one gift, independently of item quantities and other discounts.
Unpaid, abandoned and failed checkouts never consume slots. Retried webhooks
cannot create duplicate awards. An optimistic counter update prevents parallel
payments exceeding the cap; a conflict aborts settlement for provider retry.
The 50th award disables the campaign and removes the linked banner on the next
page request. Already-open pages update when refreshed.

Pausing preserves the count. Re-enabling a full campaign requires raising its
limit or explicitly starting a new cycle. A new cycle resets the allowance;
past order gifts keep their original name, cycle and sequence. Refunds do not
reopen slots or rewrite fulfilment history.

Gifts are saved as complimentary fulfilment records, shown on the buyer's order
and the operations order screen, and included in a separate transactional notice
to buyer and store operations. Staff confirm each gift packed before the order
can move to ready-to-ship (the existing documented manager override remains).
This is a **packing instruction**, not a separately stocked gift SKU, automatic
print job or production reservation. Include the gift in physical packaging,
shipping-weight and manufacturing planning. No arbitrary gift weight is assumed.

## Reviews

The product page allows a verified purchaser to submit a public display name,
1–5 rating and 10–2000 character review. Signed-in users must have verified email;
guests use the existing Help & requests email verification. The API checks the
current store, exact product, buyer identity, paid order status and successful
payment. One review per product per order is enforced in the database. Public
responses never expose purchaser email, address or order number.

New reviews are pending. Moderate the latest 100 in the shared-content screen.
Published reviews appear on that product and in Home's review section. Once
there is a published review for a public active product, all examples disappear
from Home. The CMS can hide examples before that, disable the review feature,
or change the number of Home reviews. Only the customer's original rating and
text are published; moderation changes status without rewriting them.

## Visual scope

The header keeps a fixed aligned width during scroll, one wordmark position and
a yellow star. Its colour treatment switches at the compact stage; the central
tab dissolves without moving a hard edge across the lettering. Account/cart
controls retain their previous session and capability rules. Favourites use a
presence dot rather than a numeric badge. The footer no longer changes when a
page contains a support section; its colours, logo treatment, links and social
profiles remain configurable. Instagram/Facebook entries are created without
invented profile URLs.

Typography controls include line height and letter spacing. Banner headings can
use Bebas Neue and copy Caveat, with Inter also available; these are configurable
treatments based on the supplied visual, **not a claim that every Zeplin layer's
font or pixel measurements were verified**. The incomplete Zeplin extraction is
still a limit on an exact site-wide design-parity claim. Uploaded banner artwork
can preserve the final designer-approved composition exactly.

## Validation and deployment

Unit tests cover gift boundaries/idempotency, campaign visibility, real/example
review selection and purchase verification. CI also runs
`scripts/check-store-experience.ts` in its disposable PostgreSQL database to
exercise migration defaults and concurrent allocation of the final gift slot.
Its destructive fixtures are guarded to the CI localhost development database.

Deploy the code and both migrations together through the existing production
workflow. Production deployment still requires manual workflow dispatch and
the protected environment approval. A successful push validation is not itself
a production deployment. No live store has been modified by the local fixtures.
