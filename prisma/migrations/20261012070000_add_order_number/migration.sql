CREATE SEQUENCE "Order_orderNumber_seq";

ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;

WITH ranked_orders AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS "number"
  FROM "Order"
)
UPDATE "Order" AS orders
SET "orderNumber" = ranked_orders."number"
FROM ranked_orders
WHERE orders."id" = ranked_orders."id";

SELECT setval(
  '"Order_orderNumber_seq"',
  COALESCE((SELECT MAX("orderNumber") FROM "Order"), 1),
  EXISTS (SELECT 1 FROM "Order")
);

ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
