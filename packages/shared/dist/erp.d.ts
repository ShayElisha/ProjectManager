import type { VendorComparison } from "./vendor-scoring";
export type PurchaseOrderStatus = "draft" | "submitted" | "approved" | "received" | "cancelled";
export interface ErpSupplier {
    id: string;
    organizationId: string;
    name: string;
    taxId?: string;
    email?: string;
    phone?: string;
    createdAt: string;
}
export interface ErpPurchaseOrder {
    id: string;
    organizationId: string;
    projectId?: string;
    supplierId: string;
    supplierName?: string;
    poNumber: string;
    status: PurchaseOrderStatus;
    totalAmount: number;
    currency: string;
    notes?: string;
    rfqComparisonId?: string;
    vendorQuoteId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ProjectVendorQuotesData {
    projectId: string;
    comparisons: VendorComparison[];
    updatedAt: string;
}
export interface CreatePurchaseOrderInput {
    supplierId: string;
    totalAmount: number;
    currency?: string;
    notes?: string;
    rfqComparisonId?: string;
    vendorQuoteId?: string;
}
export interface CreatePoFromRfqInput {
    comparisonId: string;
    vendorId: string;
    notes?: string;
}
//# sourceMappingURL=erp.d.ts.map