import { useTranslation } from "react-i18next";

export default function PageLoadingSpinner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t("a11y.loading")}
      className="min-h-[40vh] flex items-center justify-center"
    >
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
