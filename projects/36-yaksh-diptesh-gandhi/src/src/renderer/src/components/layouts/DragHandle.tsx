import { ReactElement } from 'react'

export interface DragHandleProps {
  onMouseDown: () => void
}

export default function DragHandle({ onMouseDown }: DragHandleProps): ReactElement {
  return (
    <div
      className="w-3 shrink-0 cursor-col-resize hover:bg-muted/30 transition-colors"
      onMouseDown={onMouseDown}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    />
  )
}
