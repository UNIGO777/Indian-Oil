import { useMemo } from 'react'
import { Arrow, Circle, Layer, Line, Path, Rect, Stage, Text } from 'react-konva'
import { generateKonvaDrawData } from '../utils/ioclLayoutEngine.js'

function toPixels(value, scale) {
  return value * scale
}

function mapStyle(style, scale) {
  if (!style) return {}
  const dash = Array.isArray(style.dash) ? style.dash : []
  return {
    stroke: style.stroke ?? '#111827',
    fill: style.fill ?? 'transparent',
    dash: dash.length ? dash.map((d) => d * scale) : undefined,
    strokeWidth: style.strokeWidth ?? 1,
  }
}

function renderShape(item, scale, offset) {
  const x = offset.x + toPixels(item.position.x, scale)
  const y = offset.y + toPixels(item.position.y, scale)
  const rotation = item.rotation ?? 0
  const style = mapStyle(item.style, scale)

  if (item.shape === 'rect') {
    return (
      <Rect
        key={item.id ?? item.type}
        x={x}
        y={y}
        width={toPixels(item.dimensions.width, scale)}
        height={toPixels(item.dimensions.height, scale)}
        rotation={rotation}
        cornerRadius={
          typeof item.dimensions.cornerRadius === 'number'
            ? toPixels(item.dimensions.cornerRadius, scale)
            : 0
        }
        {...style}
      />
    )
  }

  if (item.shape === 'circle') {
    return (
      <Circle
        key={item.id ?? item.type}
        x={x}
        y={y}
        radius={toPixels(item.dimensions.radius, scale)}
        {...style}
      />
    )
  }

  if (item.shape === 'line') {
    const points = (item.dimensions.points ?? []).map((p, idx) =>
      idx % 2 === 0 ? offset.x + toPixels(p, scale) : offset.y + toPixels(p, scale),
    )
    return <Line key={item.id ?? item.type} points={points} {...style} />
  }

  if (item.shape === 'path') {
    return (
      <Path
        key={item.id ?? item.type}
        x={offset.x}
        y={offset.y}
        data={item.dimensions.d}
        scaleX={scale}
        scaleY={scale}
        {...style}
      />
    )
  }

  if (item.shape === 'arrow') {
    const points = (item.dimensions.points ?? []).map((p, idx) =>
      idx % 2 === 0 ? offset.x + toPixels(p, scale) : offset.y + toPixels(p, scale),
    )
    return (
      <Arrow
        key={item.id ?? item.type}
        points={points}
        pointerLength={8}
        pointerWidth={8}
        {...style}
      />
    )
  }

  return null
}

function DrawPage() {
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem('ioclLayoutInput') : null
  const inputData = stored ? JSON.parse(stored) : null

  const scene = useMemo(() => {
    if (!inputData) return null
    return generateKonvaDrawData(inputData)
  }, [inputData])

  const scale = 18
  const paddingPx = 40

  if (!inputData) {
    return (
      <main className="min-h-dvh bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Layout</h1>
          <p className="mt-2 text-sm text-slate-600">No input found. Go to /form and submit first.</p>
        </div>
      </main>
    )
  }

  if (!scene?.valid) {
    return (
      <main className="min-h-dvh bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Layout</h1>
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {scene?.error ?? 'Failed to generate layout'}
          </div>
        </div>
      </main>
    )
  }

  const plotWidth = inputData.plot.width
  const plotDepth = inputData.plot.depth
  const stageWidth = paddingPx * 2 + toPixels(plotWidth, scale)
  const stageHeight = paddingPx * 2 + toPixels(plotDepth, scale)

  const offset = { x: paddingPx, y: paddingPx }

  const { draw } = scene

  const sb = draw.find((d) => d.type === 'sales_building')
  const entryArrow =
    sb && inputData.salesBuilding?.entrySide
      ? {
          type: 'sb_entry_arrow',
          shape: 'arrow',
          position: { x: 0, y: 0 },
          dimensions: {
            points:
              inputData.salesBuilding.entrySide === 'inside'
                ? [
                    sb.position.x + sb.dimensions.width / 2,
                    sb.position.y + 0.8,
                    sb.position.x + sb.dimensions.width / 2,
                    sb.position.y + sb.dimensions.height - 0.8,
                  ]
                : [
                    sb.position.x + sb.dimensions.width / 2,
                    sb.position.y + sb.dimensions.height - 0.8,
                    sb.position.x + sb.dimensions.width / 2,
                    sb.position.y + 0.8,
                  ],
          },
          rotation: 0,
          style: { stroke: '#111827', fill: '#111827' },
        }
      : null

  const labelObjects = draw
    .filter((d) => d.shape === 'label')
    .map((l) => {
      const x = offset.x + toPixels(l.position.x, scale)
      const y = offset.y + toPixels(l.position.y, scale)
      return (
        <Text
          key={l.id ?? l.type}
          x={x}
          y={y}
          width={toPixels(l.dimensions.width, scale)}
          height={toPixels(l.dimensions.height, scale)}
          text={l.text.value}
          fontSize={toPixels(l.text.fontSize, scale)}
          align={l.text.align ?? 'center'}
          verticalAlign="middle"
          fill={l.text.fill ?? '#111827'}
        />
      )
    })

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">IOCL Layout</h1>
            <p className="mt-1 text-sm text-slate-600">
              Plot: {plotWidth}m × {plotDepth}m · Road: {inputData.roadType} · Tanks: {inputData.tanks.count} · MPDs:{' '}
              {inputData.mpds.count}
            </p>
          </div>
          <a className="text-sm font-medium text-slate-900 underline" href="/form">
            Edit inputs
          </a>
        </div>

        <div className="mt-6 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Stage height={stageHeight} width={stageWidth}>
            <Layer>
              <Rect
                x={0}
                y={0}
                width={stageWidth}
                height={stageHeight}
                fill="#ffffff"
                stroke="transparent"
              />
              {draw
                .filter((d) => d.shape !== 'label')
                .map((item) => renderShape(item, scale, offset))}
              {entryArrow ? renderShape(entryArrow, scale, offset) : null}
              {labelObjects}
            </Layer>
          </Stage>
        </div>
      </div>
    </main>
  )
}

export default DrawPage
