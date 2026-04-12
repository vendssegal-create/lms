export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="mt-3 flex items-end gap-2">
      <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg border border-border bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-semibold text-text-muted">{name} yozyapti</span>
        <div className="ml-1 flex items-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
