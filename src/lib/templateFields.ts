export interface TemplateFieldConfig {
  field: string;
  alwaysNull?: boolean;
  // if this field mirrors another field's value
  mirrorOf?: string;
  // ordered list of synonym groups for fuzzy matching
  synonyms?: string[];
  // whether to ask the user if not found
  askUser?: boolean;
  // whether this field can be detected as a facility-type field
  isFacility?: boolean;
  // whether this field is a date field
  isDate?: boolean;
  // whether this is the conv factor field
  isConvFactor?: boolean;
  // whether this is a quantity field (non-conv)
  isQuantity?: boolean;
  // whether this is a price field
  isPrice?: boolean;
  // whether this is a total amount field
  isTotal?: boolean;
  // whether this is a supplier/vendor name field
  isSupplier?: boolean;
}

export const TEMPLATE_FIELDS: TemplateFieldConfig[] = [
  {
    field: 'FacilityID',
    synonyms: ['facility id', 'facility_id', 'facilityid', 'account number', 'account_number', 'accountnumber', 'customer id', 'customer_id', 'site id'],
    askUser: true,
    isFacility: true,
  },
  {
    field: 'FacilityName',
    synonyms: ['facility name', 'facility_name', 'facilityname', 'customer name', 'customer_name', 'customername', 'hospital name', 'hospital_name', 'account name', 'account_name', 'site name', 'client name'],
    askUser: true,
    isFacility: true,
  },
  {
    field: 'InvoiceExtractDate',
    alwaysNull: true,
  },
  {
    field: 'InvoiceDate',
    synonyms: ['invoice date', 'invoice_date', 'invoicedate', 'date', 'bill date', 'billing date', 'transaction date'],
    askUser: true,
    isDate: true,
  },
  {
    field: 'InvoiceNumber',
    synonyms: ['invoice number', 'invoice_number', 'invoicenumber', 'invoice #', 'invoice no', 'invoice num'],
  },
  {
    field: 'InvoiceLineNumber',
    synonyms: ['invoice line', 'invoice line number', 'invoice_line_number', 'line number', 'line_number', 'line no', 'line item', 'line #'],
  },
  {
    field: 'TotalInvoiceAmount',
    synonyms: ['ext sales', 'extended amount', 'extended price', 'extended_amount', 'sales dollars', 'sales_dollars', 'total amount', 'total_amount', 'total', 'invoice total', 'invoice amount'],
    isTotal: true,
  },
  {
    field: 'InvoiceSupplierId',
    synonyms: ['supplier id', 'supplier_id', 'supplierid', 'vendor id', 'vendor_id', 'distributor id', 'distributor_id'],
  },
  {
    field: 'SupplierName',
    synonyms: ['supplier name', 'supplier_name', 'suppliername', 'vendor name', 'vendor_name', 'vendorname', 'distributor name', 'distributor_name', 'distributorname', 'vendor', 'supplier', 'distributor'],
    askUser: true,
    isSupplier: true,
  },
  {
    field: 'SupplierCatalogNumber',
    synonyms: ['supplier catalog number', 'supplier catalog', 'vendor number', 'vendor_number', 'distributor catalog number', 'distributor catalog', 'distributor_catalog_number', 'part number', 'part_number', 'partnumber', 'item number', 'item_number', 'catalog number', 'catalog_number', 'sku'],
  },
  {
    field: 'SupplierCatalogDescription',
    synonyms: ['item desc', 'item_desc', 'item description', 'item_description', 'material description', 'material_description', 'product description', 'product_description', 'description', 'product desc', 'product name'],
  },
  {
    field: 'InvoiceUnitofMeasure',
    synonyms: ['uom', 'unit of measure', 'unit_of_measure', 'unitofmeasure', 'puom', 'puom factor', 'unit of measure - standard', 'sales uom', 'invoice uom'],
  },
  {
    field: 'InvoiceUnitofMeasurePrice',
    synonyms: ['price', 'unit price', 'unit_price', 'unitprice', 'current price', 'current_price', 'invoice price', 'each price', 'cost'],
    isPrice: true,
  },
  {
    field: 'InvoiceUnitofMeasureQuantity',
    synonyms: ['qty shipped', 'qty_shipped', 'quantity shipped', 'quantity_purchased', 'quantity purchased', 'quantity in standard units', 'quantity_in_standard_units', 'qty', 'quantity', 'units', 'shipped qty', 'ordered qty'],
    isQuantity: true,
  },
  { field: 'DepartmentCode', synonyms: ['department code', 'dept code', 'dept_code', 'department_code', 'cost center code'] },
  { field: 'DepartmentName', synonyms: ['department name', 'dept name', 'dept_name', 'department_name', 'cost center name', 'cost center'] },
  { field: 'DepartmentSubAccountCode', synonyms: ['department sub account code', 'dept sub account', 'sub account code', 'sub_account_code'] },
  { field: 'DepartmentSubAccountName', synonyms: ['department sub account name', 'dept sub account name', 'sub account name', 'sub_account_name'] },
  { field: 'GLAccountNumber', synonyms: ['gl account number', 'gl account', 'gl_account_number', 'general ledger account', 'gl number', 'gl acct'] },
  { field: 'GLAccountName', synonyms: ['gl account name', 'gl_account_name', 'general ledger account name'] },
  { field: 'GLSubAccountNumber', synonyms: ['gl sub account number', 'gl sub account', 'gl_sub_account_number', 'gl sub number'] },
  { field: 'GLSubAccountName', synonyms: ['gl sub account name', 'gl_sub_account_name'] },
  { field: 'GLDescription', synonyms: ['gl description', 'gl_description', 'general ledger description', 'gl desc'] },
  {
    field: 'PODate',
    synonyms: ['po date', 'po_date', 'purchase order date', 'order date', 'po date range'],
    isDate: true,
    mirrorOf: 'InvoiceDate',
  },
  {
    field: 'PONumber',
    synonyms: ['po number', 'po_number', 'ponumber', 'purchase order number', 'purchase order', 'po #', 'po num', 'order number'],
  },
  {
    field: 'POLineNumber',
    synonyms: ['po line number', 'po_line_number', 'po line', 'purchase order line', 'po line #'],
  },
  {
    field: 'POUnitofMeasure',
    synonyms: ['po uom', 'po unit of measure', 'purchase order uom'],
    mirrorOf: 'InvoiceUnitofMeasure',
  },
  {
    field: 'POUnitofMeasurePrice',
    synonyms: ['po price', 'po unit price', 'purchase order price'],
    isPrice: true,
    mirrorOf: 'InvoiceUnitofMeasurePrice',
  },
  {
    field: 'POUnitofMeasureQuantity',
    synonyms: ['po quantity', 'po qty', 'purchase order quantity', 'po unit quantity'],
    isQuantity: true,
    mirrorOf: 'InvoiceUnitofMeasureQuantity',
  },
  {
    field: 'MMISQuantityPerPurchaseUnitofMeasure',
    synonyms: ['conv', 'conversion', 'conv factor', 'conversion factor', 'uom conv factor', 'unit of measure conv factor', 'packaging', 'packaging string', 'puom factor (sales um)', 'packaging uom each'],
    isConvFactor: true,
  },
  { field: 'MMISItemNumber', synonyms: ['mmis item number', 'mmis_item_number', 'mmis item', 'item id', 'item_id'] },
  { field: 'MMISManufacturerID', synonyms: ['mmis manufacturer id', 'mmis manufacturer code', 'manufacturer id', 'manufacturer_id', 'manuf id', 'vma number', 'vma_number'] },
  { field: 'MMISManufacturerDivision', synonyms: ['mmis manufacturer division', 'manufacturer division', 'manuf division'] },
  {
    field: 'MMISManufacturerName',
    synonyms: ['manufacturer name', 'manufacturer_name', 'manufacturername', 'manuf name', 'manuf_name', 'vendor description', 'vendor_description'],
  },
  {
    field: 'MMISManufacturerCatalogNumber',
    synonyms: ['manufacturer catalog number', 'manufacturer_catalog_number', 'manuf number', 'manuf_number', 'manufacturer catlog number', 'vendor catalog number', 'vendor_catalog_number', 'mfr catalog', 'mfr number'],
  },
  { field: 'ItemType', synonyms: ['item type', 'item_type', 'itemtype', 'type'] },
  { field: 'MMISFacilityCategoryID', synonyms: ['mmis category id', 'mmis_category_id', 'category id', 'category_id', 'mmisfacilitycategoryid', 'mmis facility category id'] },
  { field: 'MMISFacilityCategoryDescription', synonyms: ['mmis category description', 'mmis category desc', 'category description', 'category_description', 'mmis facility category description'] },
  { field: 'MMISSubCategoryID', synonyms: ['mmis sub category id', 'sub category id', 'subcategory id', 'subcategoryid'] },
  { field: 'MMISSubCategoryDescription', synonyms: ['mmis sub category description', 'sub category description', 'subcategory description'] },
  {
    field: 'AmountPaid',
    synonyms: ['amount paid', 'amount_paid', 'amountpaid', 'ext sales', 'extended amount', 'extended price', 'sales dollars', 'total amount', 'paid amount'],
    isTotal: true,
    mirrorOf: 'TotalInvoiceAmount',
  },
  {
    field: 'PostingDate',
    synonyms: ['posting date', 'posting_date', 'postingdate', 'post date'],
    isDate: true,
    mirrorOf: 'InvoiceDate',
  },
  { field: 'ContractIndicator', synonyms: ['contract indicator', 'contract_indicator', 'on contract', 'contract flag'] },
  { field: 'ContractNumber', synonyms: ['contract number', 'contract_number', 'contractnumber', 'contract #', 'contract no'] },
  { field: 'ContractName', synonyms: ['contract name', 'contract_name', 'contractname'] },
  { field: 'TransactionType', synonyms: ['transaction type', 'transaction_type', 'transactiontype', 'trans type', 'txn type'] },
  { field: 'CheckNumber', synonyms: ['check number', 'check_number', 'checknumber', 'check #', 'check no', 'chk number'] },
  { field: 'CheckDate', synonyms: ['check date', 'check_date', 'checkdate', 'chk date'] },
  { field: 'UNSPSC', synonyms: ['unspsc', 'unspsc code', 'unspsc commodity code', 'commodity code'] },
  { field: 'GTIN', synonyms: ['gtin', 'global trade item number'] },
  { field: 'NDC', synonyms: ['ndc', 'national drug code', 'ndc code'] },
];

export const TEMPLATE_FIELD_NAMES = TEMPLATE_FIELDS.map(f => f.field);
