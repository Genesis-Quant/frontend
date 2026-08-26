export type ProjectSortOrder = "asc" | "desc";

export type ProjectListParams<TSort extends string> = {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: TSort;
  sort_order?: ProjectSortOrder;
};
