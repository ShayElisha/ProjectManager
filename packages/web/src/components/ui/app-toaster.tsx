import { Toaster } from "sonner";
import { useAppStore } from "@/store/app-store";

export function AppToaster() {
  const theme = useAppStore((s) => s.theme);

  return (
    <Toaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        className: "font-[inherit]",
        duration: 4000,
      }}
    />
  );
}
