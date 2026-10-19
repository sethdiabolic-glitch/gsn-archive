import { createFileRoute } from "@tanstack/react-router";
import { PasswordRecoveryPage } from "../PasswordRecovery";
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — GSN Arena" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PasswordRecoveryPage,
});
