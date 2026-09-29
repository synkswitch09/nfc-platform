"use client";

import { MediaUploadField } from "@/components/media-upload-field";

type Props = {
  categoryId?: string;
  uploadEndpoint?: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
};

export function CategoryImageUploadField({ categoryId, uploadEndpoint, label, name, value, onChange }: Props) {
  return <MediaUploadField uploadEndpoint={uploadEndpoint ?? (categoryId ? `/api/admin/categories/${categoryId}/images` : undefined)} disabledMessage="Save the page first, then upload its images." label={label} name={name} value={value} onChange={onChange} />;
}
