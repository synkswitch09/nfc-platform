import { describe, expect, it } from "vitest";
import { allCategoryUseCases, categoryUseCases } from "@/lib/category-content";
import { categorySectionOrders } from "@/lib/category-layout";
import { categoryPublicPath } from "@/lib/category-query";

describe("category landing content", () => {
  it("orders structured CMS items and filters hidden use cases", () => {
    const content = [
      { icon: "plane", title: "Travel", description: "Useful while travelling.", order: 2, visible: true },
      { icon: "home", title: "Home", description: "Useful close to home.", order: 0, visible: false },
      { icon: "map", title: "Recovery", description: "Useful when something is lost.", order: 1, visible: true },
    ];
    expect(allCategoryUseCases(content).map(item => item.title)).toEqual(["Home", "Recovery", "Travel"]);
    expect(categoryUseCases(content).map(item => item.title)).toEqual(["Recovery", "Travel"]);
  });

  it("provides a distinct CMS-selected composition for each initial category", () => {
    const orders = Object.values(categorySectionOrders).map(order => order.join(","));
    expect(new Set(orders).size).toBe(5);
  });

  it("builds clean root category paths", () => {
    expect(categoryPublicPath("social-media")).toBe("/social-media");
  });
});
