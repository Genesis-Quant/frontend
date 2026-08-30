export type ParquetColumnMetadata = {
  name: string;
  type: string;
  nullable: boolean;
};

export type ParquetOutput<Name extends string> = {
  name: Name;
  filename: string;
  size: number;
  modified_at: string;
  row_count: number;
  columns: ParquetColumnMetadata[];
  sha256: string;
};
