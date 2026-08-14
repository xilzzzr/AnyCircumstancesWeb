import { Mail, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function HelpPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="micro-label"><span className="status-dot" /> SUPPORT</div>
        <h1 className="mt-4 text-3xl lg:text-4xl">How can we help?</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Questions about your vault, account, uploads, or subscription are welcome. Our team will respond by email.
        </p>

        <Card className="editorial-card mt-8">
          <CardContent className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
                <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-medium">Email support</h2>
                <p className="mt-1 text-sm text-muted-foreground">Please don’t include passwords, recovery keys, or private vault contents.</p>
              </div>
            </div>
            <Button asChild className="shrink-0 gap-2">
              <a href="mailto:contact@anycircumstances.com?subject=AnyCircumstances%20account%20support">
                <Mail className="h-4 w-4" aria-hidden="true" /> Email us
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
