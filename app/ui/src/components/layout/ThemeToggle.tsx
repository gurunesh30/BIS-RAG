import { useTheme } from '@/lib/theme-provider'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="relative h-9 w-9 rounded-lg border border-border bg-card p-0 text-foreground hover:bg-muted"
        title={`Current: ${theme} mode. Click to toggle to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode.`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-primary" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>

      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground capitalize">
          {theme} mode
        </span>
      )}
    </div>
  )
}

export function ThemeModeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
          theme === 'light'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
          theme === 'dark'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Moon className="h-3.5 w-3.5 text-primary" />
        Dark
      </button>
      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
          theme === 'system'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Monitor className="h-3.5 w-3.5" />
        System
      </button>
    </div>
  )
}
