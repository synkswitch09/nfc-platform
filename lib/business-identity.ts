import { z } from "zod";

export function validAbn(abn: string) {
  if (!/^\d{11}$/.test(abn)) return false;
  const digits = [...abn].map(Number); digits[0] -= 1;
  return digits.reduce((sum, digit, index) => sum + digit * [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19][index], 0) % 89 === 0;
}
export const businessAbnSchema = z.string().trim().transform(value => value.replace(/\s/g, "")).refine(value => value === "" || validAbn(value), "Enter a valid 11-digit Australian Business Number");
