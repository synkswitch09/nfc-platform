import type { CategoryLandingLayout } from "@prisma/client";

export const categorySectionOrders: Record<CategoryLandingLayout, readonly string[]> = {
  EDITORIAL: ["benefits", "steps", "stories", "use-cases", "products", "faq"],
  ASSURANCE: ["benefits", "stories", "steps", "use-cases", "products", "faq"],
  EXECUTIVE: ["benefits", "products", "stories", "use-cases", "steps", "faq"],
  MOMENTUM: ["use-cases", "benefits", "steps", "stories", "products", "faq"],
  JOURNEY: ["steps", "benefits", "use-cases", "stories", "products", "faq"],
};
