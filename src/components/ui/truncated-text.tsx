import { cn } from "@/lib/utils";

export function TruncatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("block max-w-full min-w-0 truncate", className)} title={text}>
      {text}
    </span>
  );
}

