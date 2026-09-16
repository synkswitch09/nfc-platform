"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

export type GeneralFaqItem = {
  id: string;
  question: string;
  answer: string;
  visible: boolean;
  order: number;
};

function ordered(items: GeneralFaqItem[]) {
  return items.map((item, order) => ({ ...item, order }));
}

export function GeneralFaqEditor({
  pageId,
  initialItems,
  initialSectionId,
}: {
  pageId: string;
  initialItems: GeneralFaqItem[];
  initialSectionId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(() => ordered(initialItems));
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const update = (index: number, changes: Partial<GeneralFaqItem>) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    );
  const move = (index: number, delta: number) =>
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return ordered(next);
    });
  const remove = (index: number) =>
    setItems((current) =>
      ordered(current.filter((_, itemIndex) => itemIndex !== index)),
    );
  const add = () =>
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        question: "",
        answer: "",
        visible: true,
        order: current.length,
      },
    ]);

  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/admin/pages/${pageId}/sections`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sections: [
          {
            ...(sectionId ? { id: sectionId } : {}),
            type: "FAQ",
            name: "General FAQs",
            visible: true,
            content: { items: ordered(items) },
          },
        ],
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(result.error ?? "Questions could not be saved");
      return;
    }
    const saved = Array.isArray(result.sections)
      ? result.sections.find(
          (section: { type?: string }) => section.type === "FAQ",
        )
      : undefined;
    if (saved?.id) setSectionId(saved.id);
    setItems(ordered(items));
    setMessage("General FAQs saved and published");
    router.refresh();
  }

  return (
    <section className="admin-panel" id="faqs">
      <div className="panel-heading">
        <div>
          <h2>General FAQs</h2>
          <p>
            These appear after the FAQs inherited from every published category.
            Each question is an expandable item on the public FAQ page.
          </p>
        </div>
        <button
          className="button"
          type="button"
          onClick={save}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save FAQs"}
        </button>
      </div>
      <div className="landing-collection">
        <div className="collection-heading">
          <div>
            <h3>Questions</h3>
            <p>
              Add general help that does not belong to one product category.
            </p>
          </div>
          <button className="button secondary" type="button" onClick={add}>
            <Plus size={16} /> Add question
          </button>
        </div>
        {items.length ? (
          <div className="landing-items">
            {items.map((item, index) => (
              <div className="variant-editor" key={item.id}>
                <label className="field wide">
                  Question
                  <input
                    value={item.question}
                    onChange={(event) =>
                      update(index, { question: event.target.value })
                    }
                  />
                </label>
                <label className="field wide">
                  Answer
                  <textarea
                    value={item.answer}
                    onChange={(event) =>
                      update(index, { answer: event.target.value })
                    }
                  />
                </label>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    type="button"
                    title={item.visible ? "Hide question" : "Show question"}
                    onClick={() => update(index, { visible: !item.visible })}
                  >
                    {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title="Move up"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title="Move down"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    title="Delete question"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-empty">
            No general questions yet. Add the first one above.
          </p>
        )}
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
