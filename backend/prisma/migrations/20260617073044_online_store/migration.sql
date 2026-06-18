-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSale" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "soldByUserId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountTotal" INTEGER NOT NULL,
    "amountCash" INTEGER NOT NULL DEFAULT 0,
    "amountQr" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cashSessionId" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "ProductSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_orgId_active_idx" ON "Product"("orgId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Product_orgId_code_key" ON "Product"("orgId", "code");

-- CreateIndex
CREATE INDEX "ProductSale_branchId_soldAt_idx" ON "ProductSale"("branchId", "soldAt");

-- CreateIndex
CREATE INDEX "ProductSale_orgId_soldAt_idx" ON "ProductSale"("orgId", "soldAt");

-- CreateIndex
CREATE INDEX "ProductSale_soldByUserId_soldAt_idx" ON "ProductSale"("soldByUserId", "soldAt");

-- CreateIndex
CREATE INDEX "ProductSaleItem_saleId_idx" ON "ProductSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "ProductSaleItem_productId_idx" ON "ProductSaleItem"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleItem" ADD CONSTRAINT "ProductSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ProductSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleItem" ADD CONSTRAINT "ProductSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
