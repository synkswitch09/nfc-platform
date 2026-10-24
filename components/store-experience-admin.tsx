"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUploadField } from "@/components/media-upload-field";
import type { BannerGroup, ExperienceConfig } from "@/lib/store-experience";
type Campaign = {
  categoryId: string;
  giftName: string;
  limit: number;
  active: boolean;
  awardedCount: number;
  cycle: number;
} | null;
type Review = {
  id: string;
  displayName: string;
  rating: number;
  body: string;
  status: string;
  product: { name: string };
  order: { orderNumber: string };
};
export function StoreExperienceAdmin({
  initial,
  campaign,
  categories,
  reviews,
}: {
  initial: ExperienceConfig;
  campaign: Campaign;
  categories: { id: string; name: string }[];
  reviews: Review[];
}) {
  const [config, setConfig] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [gift, setGift] = useState({
    categoryId: campaign?.categoryId ?? categories[0]?.id ?? "",
    giftName: campaign?.giftName ?? "Wavy Mini Tray",
    limit: campaign?.limit ?? 50,
    active: campaign?.active ?? false,
  });
  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMessage(response.ok ? "Saved" : (result.error ?? "Could not save"));
      if (response.ok) router.refresh();
    } catch {
      setMessage("Could not save. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function groupChange(id: string, patch: Partial<BannerGroup>) {
    setConfig((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === id ? { ...group, ...patch } : group,
      ),
    }));
  }
  function newGroup() {
    setConfig((current) => ({
      ...current,
      groups: [
        ...current.groups,
        {
          id: crypto.randomUUID(),
          name: "New banner group",
          enabled: true,
          home: false,
          homePosition: 3,
          shop: false,
          shopPosition: "TOP",
          slides: [],
        },
      ],
    }));
  }
  return (
    <>
      <p role="status">{message}</p>
      <section className="admin-panel">
        <h2>Shared banner groups</h2>
        <p>
          Edit each group once. Its selected placements all use the same slides.
          Home position is the number of sections before the group (0 = first).
          You can also insert a group in any CTA section using its shared-group
          selector. Arrows and dots appear when more than one active slide
          remains.
        </p>
        {config.groups.map((group) => (
          <details key={group.id} className="admin-panel" open>
            <summary>{group.name}</summary>
            <div className="field-grid three">
              <label className="field">
                Group name
                <input
                  value={group.name}
                  maxLength={100}
                  onChange={(e) =>
                    groupChange(group.id, { name: e.target.value })
                  }
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={group.enabled}
                  onChange={(e) =>
                    groupChange(group.id, { enabled: e.target.checked })
                  }
                />
                Visible
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={group.home}
                  onChange={(e) =>
                    groupChange(group.id, { home: e.target.checked })
                  }
                />
                Home
              </label>
              <label className="field">
                Home position
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={group.homePosition}
                  onChange={(e) =>
                    groupChange(group.id, {
                      homePosition: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={group.shop}
                  onChange={(e) =>
                    groupChange(group.id, { shop: e.target.checked })
                  }
                />
                Shop
              </label>
              <label className="field">
                Shop position
                <select
                  value={group.shopPosition}
                  onChange={(e) =>
                    groupChange(group.id, {
                      shopPosition: e.target
                        .value as BannerGroup["shopPosition"],
                    })
                  }
                >
                  {["TOP", "BEFORE_PRODUCTS", "AFTER_PRODUCTS", "BOTTOM"].map(
                    (p) => (
                      <option key={p}>{p}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            {group.slides.map((slide, index) => {
              const change = (patch: Partial<typeof slide>) =>
                groupChange(group.id, {
                  slides: group.slides.map((s) =>
                    s.id === slide.id ? { ...s, ...patch } : s,
                  ),
                });
              return (
                <fieldset className="admin-panel" key={slide.id}>
                  <legend>Banner {index + 1}</legend>
                  <div className="field-grid three">
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={slide.visible}
                        onChange={(e) => change({ visible: e.target.checked })}
                      />
                      Visible
                    </label>
                    <label className="field">
                      Title
                      <input
                        value={slide.title}
                        maxLength={120}
                        onChange={(e) => change({ title: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Description
                      <textarea
                        value={slide.description}
                        maxLength={1000}
                        onChange={(e) =>
                          change({ description: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Small print
                      <textarea
                        value={slide.supportingText}
                        maxLength={400}
                        onChange={(e) =>
                          change({ supportingText: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Title font
                      <select
                        value={slide.titleFont}
                        onChange={(e) =>
                          change({
                            titleFont: e.target.value as typeof slide.titleFont,
                          })
                        }
                      >
                        {["INTER", "BEBAS_NEUE", "CAVEAT"].map((font) => (
                          <option key={font}>{font}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Description font
                      <select
                        value={slide.copyFont}
                        onChange={(e) =>
                          change({
                            copyFont: e.target.value as typeof slide.copyFont,
                          })
                        }
                      >
                        {["INTER", "BEBAS_NEUE", "CAVEAT"].map((font) => (
                          <option key={font}>{font}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Background
                      <input
                        type="color"
                        value={slide.backgroundColour}
                        onChange={(e) =>
                          change({ backgroundColour: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Text
                      <input
                        type="color"
                        value={slide.textColour}
                        onChange={(e) => change({ textColour: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Button label
                      <input
                        value={slide.ctaLabel}
                        maxLength={60}
                        onChange={(e) => change({ ctaLabel: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Internal link
                      <input
                        value={slide.ctaHref}
                        onChange={(e) => change({ ctaHref: e.target.value })}
                        placeholder="/shop"
                      />
                    </label>
                    <label className="field">
                      Campaign visibility
                      <select
                        value={slide.campaignKey}
                        onChange={(e) =>
                          change({ campaignKey: e.target.value })
                        }
                      >
                        <option value="">Independent banner</option>
                        <option value="launch-stands">
                          Launch gift: hide when paused or exhausted
                        </option>
                      </select>
                    </label>
                    <label className="field">
                      Image alternative text
                      <input
                        value={slide.imageAlt}
                        maxLength={180}
                        onChange={(e) => change({ imageAlt: e.target.value })}
                      />
                    </label>
                  </div>
                  <MediaUploadField
                    uploadEndpoint="/api/admin/settings/images"
                    label="Banner artwork (optional; replaces banner text visually)"
                    value={slide.imageUrl}
                    onChange={(imageUrl) => change({ imageUrl })}
                  />
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => {
                      const slides = [...group.slides];
                      [slides[index - 1], slides[index]] = [
                        slides[index],
                        slides[index - 1],
                      ];
                      groupChange(group.id, { slides });
                    }}
                  >
                    Move up
                  </button>{" "}
                  <button
                    type="button"
                    disabled={index === group.slides.length - 1}
                    onClick={() => {
                      const slides = [...group.slides];
                      [slides[index + 1], slides[index]] = [
                        slides[index],
                        slides[index + 1],
                      ];
                      groupChange(group.id, { slides });
                    }}
                  >
                    Move down
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() =>
                      groupChange(group.id, {
                        slides: group.slides.filter((s) => s.id !== slide.id),
                      })
                    }
                  >
                    Remove banner
                  </button>
                </fieldset>
              );
            })}
            <button
              type="button"
              disabled={group.slides.length >= 20}
              onClick={() =>
                groupChange(group.id, {
                  slides: [
                    ...group.slides,
                    {
                      id: crypto.randomUUID(),
                      title: "New promotion",
                      description: "",
                      supportingText: "",
                      visible: true,
                      imageUrl: "",
                      imageAlt: "",
                      backgroundColour: "#b9afcf",
                      textColour: "#243247",
                      ctaLabel: "",
                      ctaHref: "",
                      campaignKey: "",
                      titleFont: "BEBAS_NEUE",
                      copyFont: "CAVEAT",
                    },
                  ],
                })
              }
            >
              Add banner
            </button>{" "}
            <button
              type="button"
              onClick={() =>
                setConfig((current) => ({
                  ...current,
                  groups: current.groups.filter((g) => g.id !== group.id),
                }))
              }
            >
              Remove group
            </button>
          </details>
        ))}
        <button
          type="button"
          disabled={config.groups.length >= 20}
          onClick={newGroup}
        >
          New shared group
        </button>
        <h2>Reviews</h2>
        <label className="check-field">
          <input
            type="checkbox"
            checked={config.reviewsEnabled}
            onChange={(e) =>
              setConfig({ ...config, reviewsEnabled: e.target.checked })
            }
          />
          Enable customer reviews
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={config.showExampleReviews}
            onChange={(e) =>
              setConfig({ ...config, showExampleReviews: e.target.checked })
            }
          />
          Show clearly labelled examples until the first approved real review
        </label>
        <label className="field">
          Home review count
          <input
            type="number"
            min={1}
            max={12}
            value={config.reviewsLimit}
            onChange={(e) =>
              setConfig({ ...config, reviewsLimit: Number(e.target.value) })
            }
          />
        </label>
        <p>
          All real reviews require a verified paid purchase and approval.
          Publishing the first real review automatically hides every example on
          Home.
        </p>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() =>
            void send("/api/admin/storefront/experience", "PUT", config)
          }
        >
          Save content and placements
        </button>
      </section>
      <section className="admin-panel">
        <h2>Launch gift campaign</h2>
        <p>
          {campaign?.awardedCount ?? 0} / {campaign?.limit ?? 50} qualifying
          paid orders · Cycle {campaign?.cycle ?? 1}. One complimentary gift per
          qualifying order, regardless of item quantity. The gift is recorded as
          a packing instruction and emailed to the buyer and operations; it does
          not reserve a separate gift SKU or print capacity. Allow for the gift
          when configuring packaging and manufacturing.
        </p>
        <div className="field-grid three">
          <label className="field">
            Eligible category
            <select
              value={gift.categoryId}
              onChange={(e) => setGift({ ...gift, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Complimentary gift
            <input
              value={gift.giftName}
              maxLength={120}
              onChange={(e) => setGift({ ...gift, giftName: e.target.value })}
            />
          </label>
          <label className="field">
            Paid order limit
            <input
              type="number"
              min={1}
              max={100000}
              value={gift.limit}
              onChange={(e) =>
                setGift({ ...gift, limit: Number(e.target.value) })
              }
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={gift.active}
              onChange={(e) => setGift({ ...gift, active: e.target.checked })}
            />
            Campaign active
          </label>
        </div>
        <button
          type="button"
          className="button"
          disabled={busy || !gift.categoryId}
          onClick={() =>
            void send("/api/admin/storefront/gift-campaign", "PUT", gift)
          }
        >
          Save campaign
        </button>{" "}
        <button
          type="button"
          disabled={busy || !gift.categoryId}
          onClick={() => {
            if (
              window.confirm(
                "Start a NEW campaign cycle with a fresh order allowance? Previous awards remain in the order history.",
              )
            ) {
              setGift({ ...gift, active: true });
              void send("/api/admin/storefront/gift-campaign", "PUT", {
                ...gift,
                active: true,
                restart: true,
              });
            }
          }}
        >
          Start new cycle
        </button>
        <p>
          Pausing preserves the count. Restarting starts a fresh allowance and
          preserves past awards. Refunds do not reopen used slots. Use{" "}
          <code>{"{limit}"}</code>, <code>{"{gift}"}</code> and{" "}
          <code>{"{category}"}</code> in campaign banner copy to keep it in
          sync. Leave the banner link empty for the campaign category link.
        </p>
      </section>
      <section className="admin-panel">
        <h2>Latest 100 reviews</h2>
        <p>
          Approve reviews based on authenticity and relevance, including
          critical reviews. Ratings and customer text cannot be edited here.
        </p>
        {reviews.map((review) => (
          <article className="admin-panel" key={review.id}>
            <strong>
              {review.product.name} · {review.rating}/5 · {review.status}
            </strong>
            <p>{review.body}</p>
            <small>
              {review.displayName} · {review.order.orderNumber} · Verified
              purchase
            </small>
            <div>
              {["PENDING", "PUBLISHED", "HIDDEN"].map((status) => (
                <button
                  type="button"
                  key={status}
                  disabled={busy || review.status === status}
                  onClick={() =>
                    void send(
                      `/api/admin/storefront/reviews/${review.id}`,
                      "PATCH",
                      { status },
                    )
                  }
                >
                  {status === "PUBLISHED"
                    ? "Publish"
                    : status === "HIDDEN"
                      ? "Hide"
                      : "Pending"}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
