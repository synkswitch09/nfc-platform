ALTER TABLE "ContentPage"
  ADD COLUMN "showInHeader" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showInFooter" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "headerLabel" TEXT,
  ADD COLUMN "footerLabel" TEXT,
  ADD COLUMN "navigationOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ContentPage_storeId_showInHeader_navigationOrder_idx"
  ON "ContentPage" ("storeId", "showInHeader", "navigationOrder");

CREATE INDEX "ContentPage_storeId_showInFooter_navigationOrder_idx"
  ON "ContentPage" ("storeId", "showInFooter", "navigationOrder");
