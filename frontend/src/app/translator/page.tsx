import { TranslatorView } from "@/components/translator/TranslatorView";

export default function TranslatorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sign Translator</h1>
        <p className="text-muted-foreground">
          Position your hand in front of the camera and sign ASL alphabet letters.
        </p>
      </div>
      <TranslatorView />
    </div>
  );
}
