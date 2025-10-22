// Structure for a single row in the master product CSV
export interface MasterProduct {
  supplierCuit: string;
  supplierName: string;
  supplierCode: string;
  productCode: string;
  productName: string;
}

// Structure to store parsed master data, keyed by supplier CUIT for easy lookup
export type MasterDatabase = Map<string, {
  supplierCode: string;
  supplierName:string;
  products: { productCode: string; productName: string }[];
}>;


// Modified LineItem to hold OCR and final data
export interface LineItem {
  id: string;
  // OCR Data (for display)
  ocrDescription: string;
  ocrQuantity: number;
  ocrUnitPrice: number;
  
  // Mapped/Final Data (for editing and export)
  productCode: string; // Cod.Producto from Calipso
  productName: string; // Nom.Producto from Calipso
  quantity: number;
  unitPrice: number;
  total: number;
}


export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  cuit: string; // Supplier CUIT from OCR
  totalAmount: number;
  ivaPerception?: number | null;
  grossIncomePerception?: number | null;
  otherTaxes?: number | null;
  
  // New fields
  supplierName?: string; // Supplier Name from OCR
  identifiedSupplierCuit?: string; // CUIT of the matched supplier from master DB
  usePreloadedCatalog: boolean;

  items: LineItem[];
  originalItems?: LineItem[]; // To backup items when pre-loading catalog
}

// Fix: Moved OcrLineItem and GeminiInvoiceData here from geminiService.ts to centralize types.
export interface OcrLineItem {
  quantity: number;
  description: string;
  unitPrice: number;
  total: number;
}

// Type for raw data returned by Gemini
export type GeminiInvoiceData = Omit<InvoiceData, 'items' | 'usePreloadedCatalog' | 'identifiedSupplierCuit' | 'originalItems'> & { items: OcrLineItem[] };

export enum AppState {
  AWAITING_MASTER_DATA = 'AWAITING_MASTER_DATA', // New initial state
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  REVIEWING = 'REVIEWING',
  EXPORTED = 'EXPORTED',
  ERROR = 'ERROR',
}
