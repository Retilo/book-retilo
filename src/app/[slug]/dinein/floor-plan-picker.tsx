'use client'
// Loaded dynamically (ssr: false) — Konva uses browser Canvas API

import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Circle, Rect, Text, Group } from 'react-konva'

const VW = 900
const VH = 540

interface CanvasZone {
  id: string
  x: number
  y: number
  w: number
  h: number
  color: string
  name: string
}

interface CanvasTable {
  id: string
  x: number
  y: number
  shape: 'circle' | 'rect'
  r?: number
  w?: number
  h?: number
  label: string
  capacity: number
  available: boolean
}

interface CanvasData {
  zones: CanvasZone[]
  tables: CanvasTable[]
}

interface Props {
  canvas: CanvasData
  selectedTableId: string | null
  onSelect: (id: string | null) => void
  primaryColor?: string
}

export default function FloorPlanPicker({ canvas, selectedTableId, onSelect, primaryColor = '#a855f7' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef     = useRef<any>(null)
  const [stageW, setStageW] = useState(360)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setStageW(e.contentRect.width))
    obs.observe(el)
    setStageW(el.getBoundingClientRect().width)
    return () => obs.disconnect()
  }, [])

  const scale  = stageW / VW
  const stageH = stageW * (VH / VW)

  // Only render within visible container height (cap at 240px on mobile)
  const maxH = Math.min(stageH, 240)
  const renderH = maxH

  return (
    <div ref={containerRef} style={{ width: '100%', height: renderH, borderRadius: 16, overflow: 'hidden' }}>
      <Stage
        ref={stageRef}
        width={stageW}
        height={renderH}
        scaleX={scale}
        scaleY={scale}
      >
        {/* Background */}
        <Layer listening={false}>
          <Rect x={0} y={0} width={VW} height={VH} fill="#0e0f12" />
        </Layer>

        {/* Zone regions */}
        <Layer listening={false}>
          {(canvas.zones ?? []).map(z => (
            <Group key={z.id} x={z.x} y={z.y}>
              <Rect
                x={0} y={0} width={z.w} height={z.h}
                fill={z.color} opacity={0.12}
                stroke={z.color} strokeWidth={1} cornerRadius={6}
              />
              <Text
                x={8} y={8}
                text={z.name}
                fontSize={11} fontStyle="bold"
                fill={z.color} opacity={0.7}
              />
            </Group>
          ))}
        </Layer>

        {/* Tables */}
        <Layer>
          {(canvas.tables ?? []).map(t => {
            const isSelected  = t.id === selectedTableId
            const isAvailable = t.available
            const fill = !isAvailable ? '#222428' : isSelected ? primaryColor : '#2c3040'
            const stroke = !isAvailable
              ? 'rgba(255,255,255,0.08)'
              : isSelected
                ? primaryColor
                : 'rgba(255,255,255,0.22)'
            const cx = t.shape === 'circle' ? t.x : t.x + (t.w ?? 78) / 2
            const cy = t.shape === 'circle' ? t.y : t.y + (t.h ?? 54) / 2

            return (
              <Group
                key={t.id}
                x={cx}
                y={cy}
                listening={isAvailable}
                onClick={() => isAvailable && onSelect(isSelected ? null : t.id)}
                onTap={() => isAvailable && onSelect(isSelected ? null : t.id)}
              >
                {/* Glow ring for selected */}
                {isSelected && t.shape === 'circle' && (
                  <Circle radius={(t.r ?? 28) + 7} fill={primaryColor} opacity={0.2} listening={false} />
                )}
                {isSelected && t.shape === 'rect' && (
                  <Rect
                    x={-(t.w ?? 78) / 2 - 6} y={-(t.h ?? 54) / 2 - 6}
                    width={(t.w ?? 78) + 12} height={(t.h ?? 54) + 12}
                    fill={primaryColor} opacity={0.15} cornerRadius={14}
                    listening={false}
                  />
                )}

                {/* Table shape */}
                {t.shape === 'circle' ? (
                  <Circle
                    radius={t.r ?? 28}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2 : 1.5}
                    shadowBlur={isSelected ? 18 : 0}
                    shadowColor={primaryColor}
                    shadowOpacity={0.6}
                  />
                ) : (
                  <Rect
                    x={-(t.w ?? 78) / 2} y={-(t.h ?? 54) / 2}
                    width={t.w ?? 78} height={t.h ?? 54}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2 : 1.5}
                    cornerRadius={8}
                    shadowBlur={isSelected ? 18 : 0}
                    shadowColor={primaryColor}
                    shadowOpacity={0.6}
                  />
                )}

                {/* Label */}
                <Text
                  x={-22} y={-9} width={44} height={12}
                  text={t.label}
                  align="center"
                  fontSize={10} fontStyle="bold"
                  fill={isAvailable ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)'}
                  listening={false}
                />
                {/* Capacity */}
                <Text
                  x={-14} y={3} width={28} height={10}
                  text={`${t.capacity}p`}
                  align="center"
                  fontSize={8}
                  fill={isAvailable ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.1)'}
                  listening={false}
                />
              </Group>
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
