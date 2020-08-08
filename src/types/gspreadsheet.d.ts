declare module 'google-spreadsheet' {
    class GoogleSpreadsheet {
        constructor(sheetId: string);
        useServiceAccountAuth(creds: { client_email: string; private_key: string }): Promise<void>;
        loadInfo(): Promise<void>;
        get sheetsById(): { [id: string]: GoogleSpreadsheetWorksheet };
    }
    class GoogleSpreadsheetWorksheet {
        loadCells(sheetFilters?: string): Promise<void>;
        getCell(rowIndex: number, columnIndex: number): GoogleSpreadsheetCell;
        getCellByA1(a1Address: string): GoogleSpreadsheetCell;
        getRows(): Promise<GoogleSpreadsheetRow[]>;
        _cells: GoogleSpreadsheetCell[][];
        saveUpdatedCells(): Promise<void>;
    }
    class GoogleSpreadsheetCell {
        _sheet: GoogleSpreadsheetWorksheet;
        get rowIndex(): number;
        get columnIndex(): number;
        get a1Column(): string;
        get a1Row(): number;
        get a1Address(): string;
        value: boolean | string | number;
        formula: string;
        discardUnsavedChanges(): void;
        save(): Promise<void>;
        delete(): Promise<any>;
    }
    class GoogleSpreadsheetRow {
        _sheet: GoogleSpreadsheetWorksheet;
        save(): Promise<void>;
        delete(): Promise<any>;
    }
}
