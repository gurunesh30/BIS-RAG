import { useTheme } from '@/lib/theme-provider'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="rounded-md text-muted-foreground hover:text-foreground"
        title={`Currently ${theme} mode. Toggle to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode.`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>

      {showLabel && (
        <span className="text-xs font-medium capitalize text-muted-foreground">
          {resolvedTheme} mode
        </span>
      )}
    </div>
  )
}

export function ThemeModeSelector() {
  const { theme, setTheme } = useTheme()

  const modes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
      {modes.map((mode) => {
        const Icon = mode.icon
        const active = theme === mode.value
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => setTheme(mode.value)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}