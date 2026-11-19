import { Toast } from "@base-ui/react/toast";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import type { ReactNode } from "react";

// Short messages about something that just happened ("Booking saved"), shown
// in a corner for a few seconds and announced by screen readers. For what
// the visitor must read or act on, such as a form's errors, put the message
// in the page instead: a toast disappears.

const manager = Toast.createToastManager();

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  /** "error" is announced at once (assertive) and stays until closed. */
  type?: "success" | "error";
}

/** Shows a toast. Works from anywhere: an event handler, a mutation's callback. */
export function toast({ title, description, type = "success" }: ToastOptions) {
  return manager.add({
    title,
    description,
    type,
    priority: type === "error" ? "high" : "low",
    timeout: type === "error" ? 0 : undefined,
  });
}

/**
 * Renders the toasts: put it once around the app. `label` names the region
 * (F6 moves focus there) and `closeLabel` each close button, for screen
 * readers, in the page's language.
 */
export function Toaster({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children?: ReactNode;
}) {
  return (
    <Toast.Provider toastManager={manager}>
      {children}
      <Toast.Portal>
        <Toast.Viewport
          aria-label={label}
          className="fixed top-20 right-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ToastList closeLabel={closeLabel} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList({ closeLabel }: { closeLabel: string }) {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => {
    const Icon = item.type === "error" ? CircleAlert : CircleCheck;
    return (
      <Toast.Root
        key={item.id}
        toast={item}
        className="w-full rounded-lg border bg-card text-card-foreground shadow-lg p-4 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[limited]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Toast.Content className="flex items-start gap-3">
          <Icon
            aria-hidden="true"
            className={
              item.type === "error"
                ? "h-5 w-5 shrink-0 text-destructive-soft-foreground"
                : "h-5 w-5 shrink-0 text-primary"
            }
          />
          <div className="flex-1 min-w-0">
            {/* A paragraph, not Base UI's default h2: a toast isn't a section of
                the page, and would break its heading order. */}
            <Toast.Title render={<p />} className="text-sm font-semibold" />
            <Toast.Description className="mt-1 text-sm text-muted-foreground" />
          </div>
          <Toast.Close
            aria-label={closeLabel}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}
