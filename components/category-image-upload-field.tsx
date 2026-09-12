"use client";

import { MediaUploadField } from "@/components/media-upload-field";

type Props = {
  categoryId?: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
};

export function CategoryImageUploadField({ categoryId, label, name, value, onChange }: Props) {
  return <MediaUploadField uploadEndpoint={categoryId ? `/api/admin/categories/${categoryId}/images` : undefined} disabledMessage="Save the category first, then upload its images." label={label} name={name} value={value} onChange={onChange} />;
}
