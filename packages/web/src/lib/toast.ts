import { toast as sonnerToast } from "sonner";
import i18n from "@/i18n";

function t(key: string, params?: Record<string, string | number>) {
  return i18n.t(key, params);
}

export const toast = {
  success: (key: string, params?: Record<string, string | number>) =>
    sonnerToast.success(t(key, params)),
  error: (key: string, params?: Record<string, string | number>) =>
    sonnerToast.error(t(key, params)),
  info: (key: string, params?: Record<string, string | number>) =>
    sonnerToast.info(t(key, params)),
  message: (text: string) => sonnerToast(text),
  errorMessage: (text: string) => sonnerToast.error(text),
};
