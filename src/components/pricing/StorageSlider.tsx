import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { MAX_STORAGE_GB, MIN_STORAGE_GB, STORAGE_STEP_GB } from "@/lib/pricing";

type StorageSliderProps = {
  value: number;
  onChange: (gb: number) => void;
  disabled?: boolean;
  className?: string;
  /** Accessible name of the slider thumb. */
  label?: string;
};

// Radix's role="slider" lives on the thumb, so the accessible name and
// aria-valuetext have to be set there (the shared ui/slider can't pass them).
export function StorageSlider({ value, onChange, disabled, className, label = "Storage" }: StorageSliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={([next]) => onChange(next ?? MIN_STORAGE_GB)}
      min={MIN_STORAGE_GB}
      max={MAX_STORAGE_GB}
      step={STORAGE_STEP_GB}
      disabled={disabled}
      className={cn("relative flex h-11 w-full touch-none select-none items-center", className)}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={`${value} GB`}
        className="relative block h-6 w-6 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors before:absolute before:-inset-2.5 before:rounded-full before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}
