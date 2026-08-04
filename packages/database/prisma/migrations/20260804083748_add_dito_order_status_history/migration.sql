-- CreateTable
CREATE TABLE "dito_order_status_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dito_order_id" UUID NOT NULL,
    "previous_status" "DitoOrderStatus" NOT NULL,
    "previous_sent_substatus" "DitoSentSubstatus",
    "new_status" "DitoOrderStatus" NOT NULL,
    "new_sent_substatus" "DitoSentSubstatus",
    "previous_delivery_status" "DeliveryStatus" NOT NULL,
    "new_delivery_status" "DeliveryStatus" NOT NULL,
    "previous_no_status_detected_at" TIMESTAMPTZ(3),
    "new_no_status_detected_at" TIMESTAMPTZ(3),
    "observation" TEXT,
    "changed_by_user_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dito_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dito_order_status_history_order_changed_idx" ON "dito_order_status_history"("dito_order_id", "changed_at");

-- CreateIndex
CREATE INDEX "dito_order_status_history_org_changed_idx" ON "dito_order_status_history"("organization_id", "changed_at");

-- CreateIndex
CREATE INDEX "dito_order_status_history_user_changed_idx" ON "dito_order_status_history"("changed_by_user_id", "changed_at");

-- AddForeignKey
ALTER TABLE "dito_order_status_history" ADD CONSTRAINT "dito_order_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_status_history" ADD CONSTRAINT "dito_order_status_history_dito_order_id_fkey" FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_status_history" ADD CONSTRAINT "dito_order_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
