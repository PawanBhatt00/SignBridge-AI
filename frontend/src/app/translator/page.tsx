import { Hand } from "lucide-react";
import { TranslatorView } from "@/components/translator/TranslatorView";

export default function TranslatorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Hand className="h-8 w-8 text-primary" />
          Sign Translator
        </h1>
        <p className="text-muted-foreground mt-1">
          Position your hand in front of the camera and sign ASL alphabet letters.
        </p>
      </div>

      <TranslatorView />
    </div>
  );
}