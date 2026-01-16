export const RULES = {
  units: 'meters',
  plot: {
    shape: 'rectangle',
    origin: { x: 0, y: 0 },
    frontY: 0,
  },
  zoning: {
    frontZoneMaxDepthRatio: 0.3,
    rearZoneMinDepthRatio: 0.65,
  },
  salesBuilding: {
    minFrontOffset: 2,
    rotationByOrientation: {
      front: 0,
      side: 90,
    },
    dimensionsByType: {
      'SB Type 1': { width: 4, depth: 5 },
      'SB Type 2': { width: 6, depth: 6 },
      'SB Type 3': { width: 8, depth: 7 },
      'SB Type 4': { width: 10, depth: 8 },
      'SB Type 5': { width: 12, depth: 9 },
    },
  },
  tanks: {
    shape: 'circle',
    radius: 1.5,
    minTankToTankSpacing: 1.5,
    minToPlotBoundary: 4,
    minToSalesBuilding: 15,
  },
  mpds: {
    shape: 'rect',
    width: 4,
    depth: 3,
    minMpdToMpdSpacing: 2,
    minToSalesBuilding: 8,
  },
  roadType: {
    NH: { accelerationLane: 120, decelerationLane: 120, taper: 60 },
    SH: { accelerationLane: 90, decelerationLane: 90, taper: 45 },
    City: null,
  },
}

const fail = (error) => ({ valid: false, error })
const ok = (data) => ({ valid: true, ...data })

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const getZones = (plotDepth) => {
  const frontZoneMaxY = plotDepth * RULES.zoning.frontZoneMaxDepthRatio
  const rearZoneMinY = plotDepth * RULES.zoning.rearZoneMinDepthRatio
  return {
    front: { minY: 0, maxY: frontZoneMaxY },
    middle: { minY: frontZoneMaxY, maxY: rearZoneMinY },
    rear: { minY: rearZoneMinY, maxY: plotDepth },
  }
}

const getSalesBuildingFootprint = (sbType, orientation) => {
  const dims = RULES.salesBuilding.dimensionsByType[sbType]
  if (!dims) return null

  if (orientation === 'side') {
    return { width: dims.depth, depth: dims.width }
  }

  return { width: dims.width, depth: dims.depth }
}

const clampWithinPlot = (plot, rect) => {
  const inside =
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= plot.width &&
    rect.y + rect.depth <= plot.depth

  return inside
}

const horizontalSpanFits = (plotWidth, spanWidth, marginX) =>
  spanWidth <= plotWidth - marginX * 2

const computeCenteredStartX = (plotWidth, itemWidth) => (plotWidth - itemWidth) / 2

const computeRowStartX = (plotWidth, totalRowWidth) =>
  computeCenteredStartX(plotWidth, totalRowWidth)

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const distanceCircleToRectEdge = (circle, rect) => {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width)
  const closestY = clamp(circle.y, rect.y, rect.y + rect.depth)
  const dx = circle.x - closestX
  const dy = circle.y - closestY
  return Math.max(0, Math.hypot(dx, dy) - circle.radius)
}

const distanceRectToRectEdge = (a, b) => {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.depth
  const bx2 = b.x + b.width
  const by2 = b.y + b.depth

  const dx = Math.max(0, Math.max(a.x - bx2, b.x - ax2))
  const dy = Math.max(0, Math.max(a.y - by2, b.y - ay2))
  return Math.hypot(dx, dy)
}

/**
 * validateLayout(inputData)
 *
 * Returns:
 * - { valid: true }
 * - { valid: false, error: string }
 */
export function validateLayout(inputData) {
  const plot = inputData?.plot
  const roadType = inputData?.roadType
  const salesBuilding = inputData?.salesBuilding
  const tanks = inputData?.tanks
  const mpds = inputData?.mpds

  if (!plot || !isFiniteNumber(plot.width) || !isFiniteNumber(plot.depth)) {
    return fail('Plot width and depth must be valid numbers')
  }
  if (plot.width <= 0 || plot.depth <= 0) {
    return fail('Plot width and depth must be greater than 0')
  }

  if (!['NH', 'SH', 'City'].includes(roadType)) {
    return fail('Invalid roadType. Expected NH, SH, or City')
  }

  if (!salesBuilding || typeof salesBuilding !== 'object') {
    return fail('Missing salesBuilding configuration')
  }

  if (!RULES.salesBuilding.dimensionsByType[salesBuilding.type]) {
    return fail('Invalid salesBuilding.type')
  }

  if (!['front', 'side'].includes(salesBuilding.orientation)) {
    return fail('Invalid salesBuilding.orientation')
  }

  if (!['front_left', 'front_center', 'front_right'].includes(salesBuilding.position)) {
    return fail('Invalid salesBuilding.position')
  }

  if (!tanks || !isFiniteNumber(tanks.count) || tanks.count < 0) {
    return fail('Invalid tanks.count')
  }

  if (!mpds || !isFiniteNumber(mpds.count) || mpds.count < 0) {
    return fail('Invalid mpds.count')
  }

  const sbResult = calculateSalesBuildingPosition(inputData)
  if (!sbResult.valid) return sbResult

  const mpdResult = calculateMPDPositions(inputData)
  if (!mpdResult.valid) return mpdResult

  const tankResult = calculateTankPositions(inputData)
  if (!tankResult.valid) return tankResult

  return { valid: true }
}

/**
 * calculateSalesBuildingPosition(inputData)
 *
 * Computes Sales Building top-left position and rotation.
 * Sales Building is always placed near the front at y = minFrontOffset.
 */
export function calculateSalesBuildingPosition(inputData) {
  const plot = inputData.plot
  const sb = inputData.salesBuilding
  const zones = getZones(plot.depth)

  const footprint = getSalesBuildingFootprint(sb.type, sb.orientation)
  if (!footprint) return fail('Invalid salesBuilding.type')

  const y = RULES.salesBuilding.minFrontOffset
  if (y + footprint.depth > zones.front.maxY) {
    return fail('Sales Building does not fit within Front Zone')
  }

  let x = 2
  if (sb.position === 'front_center') {
    x = computeCenteredStartX(plot.width, footprint.width)
  } else if (sb.position === 'front_right') {
    x = plot.width - footprint.width - 2
  }

  const rect = { x, y, width: footprint.width, depth: footprint.depth }
  if (!clampWithinPlot(plot, rect)) {
    return fail('Sales Building exceeds plot boundary')
  }

  const rotation = RULES.salesBuilding.rotationByOrientation[sb.orientation]

  return ok({
    position: { x, y },
    rotation,
    dimensions: { width: footprint.width, depth: footprint.depth },
    footprint: rect,
  })
}

/**
 * calculateTankPositions(inputData)
 *
 * Places tanks in the rear zone as circles in a horizontal row, centered.
 * Enforces:
 * - tank-to-tank spacing (edge-to-edge)
 * - tank-to-plot boundary (edge-to-boundary)
 * - tank-to-sales-building (edge-to-rect)
 */
export function calculateTankPositions(inputData) {
  const plot = inputData.plot
  const tankCount = Math.floor(inputData.tanks.count)
  const zones = getZones(plot.depth)

  if (tankCount === 0) {
    return ok({ tanks: [], tankZoneTopY: zones.rear.minY })
  }

  if (![1, 2, 3].includes(tankCount)) {
    return fail('Unsupported tank count. Expected 1, 2, or 3')
  }

  const sbResult = calculateSalesBuildingPosition(inputData)
  if (!sbResult.valid) return sbResult

  const radius = RULES.tanks.radius
  const boundary = RULES.tanks.minToPlotBoundary
  const spacing = RULES.tanks.minTankToTankSpacing

  const availableSpanY = plot.depth - zones.rear.minY - boundary * 2
  const totalStackHeight = tankCount * (radius * 2) + (tankCount - 1) * spacing
  if (totalStackHeight > availableSpanY) {
    return fail('Tanks cannot fit within Rear Zone with required spacing and margins')
  }

  const x = boundary + radius
  const startY = zones.rear.minY + boundary + radius + (availableSpanY - totalStackHeight) / 2

  const tanks = Array.from({ length: tankCount }, (_, i) => {
    const y = startY + i * (radius * 2 + spacing)
    return {
      type: 'tank',
      shape: 'circle',
      position: { x, y },
      dimensions: { radius },
      rotation: 0,
    }
  })

  const sbFootprint = sbResult.footprint
  for (const t of tanks) {
    if (t.position.x - radius < boundary || t.position.x + radius > plot.width - boundary) {
      return fail('Tank to plot boundary rule violated')
    }
    if (t.position.y - radius < boundary || t.position.y + radius > plot.depth - boundary) {
      return fail('Tank to plot boundary rule violated')
    }
    const clearance = distanceCircleToRectEdge(
      { x: t.position.x, y: t.position.y, radius },
      sbFootprint,
    )
    if (clearance < RULES.tanks.minToSalesBuilding) {
      return fail('Tank to Sales Building distance rule violated')
    }
  }

  const tankZoneTopY = Math.min(...tanks.map((t) => t.position.y - radius))
  return ok({ tanks, tankZoneTopY })
}

/**
 * calculateMPDPositions(inputData)
 *
 * Places MPDs in the middle zone as rectangles in a horizontal row.
 * Enforces:
 * - mpd-to-mpd spacing (edge-to-edge)
 * - mpd-to-sales-building minimum distance (vertical clearance)
 * - MPDs remain inside middle zone and within plot boundary
 */
export function calculateMPDPositions(inputData) {
  const plot = inputData.plot
  const mpdCount = Math.floor(inputData.mpds.count)
  const zones = getZones(plot.depth)

  if (mpdCount === 0) {
    return ok({ mpds: [] })
  }

  if (![2, 4].includes(mpdCount)) {
    return fail('Unsupported MPD count. Expected 2 or 4')
  }

  const sbResult = calculateSalesBuildingPosition(inputData)
  if (!sbResult.valid) return sbResult

  const mpdWidth = RULES.mpds.width
  const mpdDepth = RULES.mpds.depth
  const colGap = RULES.mpds.minMpdToMpdSpacing
  const rowGapOptions = [6, 4, 3, 2]

  const rows = 2
  const cols = mpdCount / 2

  const totalWidth = cols * mpdWidth + (cols - 1) * colGap
  if (!horizontalSpanFits(plot.width, totalWidth, 2)) {
    return fail('MPDs cannot fit within plot frontage with required spacing')
  }

  const sbFootprint = sbResult.footprint
  const minStartYInMiddleZone = zones.middle.minY + 1
  const minStartYInFrontZone = Math.max(RULES.salesBuilding.minFrontOffset + 1, zones.front.minY + 1)

  const startXOptionsRaw = [
    computeRowStartX(plot.width, totalWidth),
    2,
    plot.width - totalWidth - 2,
  ]

  const startXMax = plot.width - totalWidth
  const startXOptions = Array.from(
    new Map(
      startXOptionsRaw
        .map((x) => clamp(x, 0, startXMax))
        .map((x) => [x.toFixed(3), x]),
    ).values(),
  )

  const buildMpds = (startX, startY, rowGap) => {
    const mpds = []
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        mpds.push({
          type: 'mpd',
          shape: 'rect',
          position: {
            x: startX + c * (mpdWidth + colGap),
            y: startY + r * (mpdDepth + rowGap),
          },
          dimensions: { width: mpdWidth, height: mpdDepth, cornerRadius: 0.6 },
          rotation: 0,
        })
      }
    }
    return mpds
  }

  const isPlacementValid = (startX, startY, rowGap) => {
    const mpds = buildMpds(startX, startY, rowGap)
    for (const m of mpds) {
      const rect = { x: m.position.x, y: m.position.y, width: mpdWidth, depth: mpdDepth }
      if (!clampWithinPlot(plot, rect)) return false
      const clearance = distanceRectToRectEdge(rect, sbFootprint)
      if (clearance < RULES.mpds.minToSalesBuilding) return false
    }
    return true
  }

  const findPlacement = (minY, maxY, rowGap) => {
    if (minY > maxY) return null
    const step = 0.25
    for (const startX of startXOptions) {
      for (let startY = minY; startY <= maxY + 1e-9; startY += step) {
        if (isPlacementValid(startX, startY, rowGap)) return { startX, startY }
      }
    }
    return null
  }

  for (const rowGap of rowGapOptions) {
    const totalHeight = rows * mpdDepth + (rows - 1) * rowGap
    const maxStartYInDispensingZone = zones.middle.maxY - totalHeight

    const placement =
      findPlacement(minStartYInMiddleZone, maxStartYInDispensingZone, rowGap) ??
      findPlacement(minStartYInFrontZone, maxStartYInDispensingZone, rowGap)

    if (!placement) continue

    const mpds = buildMpds(placement.startX, placement.startY, rowGap)
    return ok({ mpds })
  }

  return fail('MPDs cannot be placed within Front/Middle Zone with required Sales Building clearance')
}

/**
 * generateKonvaDrawData(inputData)
 *
 * Produces an array of drawing-ready objects for Konva.js consumption.
 * If rules fail, returns { valid: false, error }.
 */
export function generateKonvaDrawData(inputData) {
  const validation = validateLayout(inputData)
  if (!validation.valid) return validation

  const plot = inputData.plot
  const zones = getZones(plot.depth)
  const roadType = inputData.roadType

  const sbResult = calculateSalesBuildingPosition(inputData)
  const mpdResult = calculateMPDPositions(inputData)
  const tankResult = calculateTankPositions(inputData)

  if (!sbResult.valid) return sbResult
  if (!mpdResult.valid) return mpdResult
  if (!tankResult.valid) return tankResult

  const plotOutline = {
    type: 'plot',
    shape: 'rect',
    position: { x: 0, y: 0 },
    dimensions: { width: plot.width, height: plot.depth },
    rotation: 0,
    style: { stroke: '#111827', fill: 'transparent', dash: [], strokeWidth: 2 },
  }

  const zoneGuides = [
    {
      type: 'zone_front',
      shape: 'rect',
      position: { x: 0, y: zones.front.minY },
      dimensions: { width: plot.width, height: zones.front.maxY - zones.front.minY },
      rotation: 0,
      style: { stroke: '#9ca3af', fill: 'transparent', dash: [1, 1] },
    },
    {
      type: 'zone_middle',
      shape: 'rect',
      position: { x: 0, y: zones.middle.minY },
      dimensions: { width: plot.width, height: zones.middle.maxY - zones.middle.minY },
      rotation: 0,
      style: { stroke: '#9ca3af', fill: 'transparent', dash: [1, 1] },
    },
    {
      type: 'zone_rear',
      shape: 'rect',
      position: { x: 0, y: zones.rear.minY },
      dimensions: { width: plot.width, height: zones.rear.maxY - zones.rear.minY },
      rotation: 0,
      style: { stroke: '#9ca3af', fill: 'transparent', dash: [1, 1] },
    },
  ]

  const roadCenterLine = {
    type: 'road_center_line',
    shape: 'line',
    position: { x: 0, y: 0 },
    dimensions: { points: [0, 0, plot.width, 0] },
    rotation: 0,
    style: { stroke: '#111827', fill: 'transparent', dash: [1, 1] },
  }

  const entryExitCurves = (() => {
    const entryStartX = Math.max(2, plot.width * 0.2)
    const exitStartX = Math.min(plot.width - 2, plot.width * 0.8)
    const curveEndY = zones.middle.minY + 2
    const entryEndX = plot.width * 0.35
    const exitEndX = plot.width * 0.65
    const controlY = Math.min(curveEndY, 10)

    if (roadType === 'City') {
      return [
        {
          type: 'entry_curve',
          shape: 'path',
          position: { x: 0, y: 0 },
          dimensions: { d: `M ${entryStartX} 0 Q ${entryStartX} ${controlY} ${entryEndX} ${curveEndY}` },
          rotation: 0,
          style: { stroke: '#111827', fill: 'transparent', dash: [] },
        },
        {
          type: 'exit_curve',
          shape: 'path',
          position: { x: 0, y: 0 },
          dimensions: { d: `M ${exitStartX} 0 Q ${exitStartX} ${controlY} ${exitEndX} ${curveEndY}` },
          rotation: 0,
          style: { stroke: '#111827', fill: 'transparent', dash: [] },
        },
      ]
    }

    const spec = RULES.roadType[roadType]
    return [
      {
        type: 'road_acceleration_lane',
        shape: 'line',
        position: { x: 0, y: 0 },
        dimensions: { points: [0, 0.6, plot.width, 0.6] },
        rotation: 0,
        style: { stroke: '#111827', fill: 'transparent', dash: [2, 2] },
        meta: { length: spec.accelerationLane },
      },
      {
        type: 'road_deceleration_lane',
        shape: 'line',
        position: { x: 0, y: 0 },
        dimensions: { points: [0, 1.2, plot.width, 1.2] },
        rotation: 0,
        style: { stroke: '#111827', fill: 'transparent', dash: [4, 2] },
        meta: { length: spec.decelerationLane },
      },
      {
        type: 'road_taper',
        shape: 'line',
        position: { x: 0, y: 0 },
        dimensions: { points: [0, 1.8, plot.width, 1.8] },
        rotation: 0,
        style: { stroke: '#111827', fill: 'transparent', dash: [1, 3] },
        meta: { length: spec.taper },
      },
      {
        type: 'entry_curve',
        shape: 'path',
        position: { x: 0, y: 0 },
        dimensions: { d: `M ${entryStartX} 0 Q ${entryStartX} ${controlY} ${entryEndX} ${curveEndY}` },
        rotation: 0,
        style: { stroke: '#111827', fill: 'transparent', dash: [] },
      },
      {
        type: 'exit_curve',
        shape: 'path',
        position: { x: 0, y: 0 },
        dimensions: { d: `M ${exitStartX} 0 Q ${exitStartX} ${controlY} ${exitEndX} ${curveEndY}` },
        rotation: 0,
        style: { stroke: '#111827', fill: 'transparent', dash: [] },
      },
    ]
  })()

  const salesBuildingDraw = {
    type: 'sales_building',
    shape: 'rect',
    position: sbResult.position,
    dimensions: { width: sbResult.dimensions.width, height: sbResult.dimensions.depth },
    rotation: sbResult.rotation,
    style: { stroke: '#111827', fill: '#e5e7eb', dash: [], strokeWidth: 2 },
  }

  const salesBuildingDetails =
    sbResult.rotation === 0
      ? [
          {
            type: 'sales_building_internal_wall',
            shape: 'line',
            position: { x: 0, y: 0 },
            dimensions: {
              points: [
                sbResult.position.x + sbResult.dimensions.width * 0.62,
                sbResult.position.y,
                sbResult.position.x + sbResult.dimensions.width * 0.62,
                sbResult.position.y + sbResult.dimensions.depth,
              ],
            },
            rotation: 0,
            style: { stroke: '#111827', fill: 'transparent', dash: [] },
          },
          {
            type: 'sales_building_internal_wall',
            shape: 'line',
            position: { x: 0, y: 0 },
            dimensions: {
              points: [
                sbResult.position.x + sbResult.dimensions.width * 0.62,
                sbResult.position.y + sbResult.dimensions.depth * 0.55,
                sbResult.position.x + sbResult.dimensions.width,
                sbResult.position.y + sbResult.dimensions.depth * 0.55,
              ],
            },
            rotation: 0,
            style: { stroke: '#111827', fill: 'transparent', dash: [] },
          },
          {
            type: 'sales_building_door_arc',
            shape: 'path',
            position: { x: 0, y: 0 },
            dimensions: {
              d: `M ${sbResult.position.x + sbResult.dimensions.width * 0.1} ${sbResult.position.y + sbResult.dimensions.depth} Q ${sbResult.position.x + sbResult.dimensions.width * 0.1} ${sbResult.position.y + sbResult.dimensions.depth * 0.7} ${sbResult.position.x + sbResult.dimensions.width * 0.35} ${sbResult.position.y + sbResult.dimensions.depth * 0.7}`,
            },
            rotation: 0,
            style: { stroke: '#111827', fill: 'transparent', dash: [0.4, 0.4] },
          },
        ]
      : []

  const mpds = mpdResult.mpds.map((m, idx) => ({
    ...m,
    id: `mpd_${idx + 1}`,
    style: { stroke: '#111827', fill: '#f9fafb', dash: [] },
  }))

  const tanks = tankResult.tanks.map((t, idx) => ({
    ...t,
    id: `tank_${idx + 1}`,
    style: { stroke: '#111827', fill: 'transparent', dash: [] },
  }))

  const tankClearanceRings = tanks.map((t, idx) => ({
    type: 'tank_clearance',
    id: `tank_clearance_${idx + 1}`,
    shape: 'circle',
    position: t.position,
    dimensions: { radius: t.dimensions.radius + RULES.tanks.minToPlotBoundary },
    rotation: 0,
    style: { stroke: '#ef4444', fill: 'transparent', dash: [1, 1], strokeWidth: 1.5 },
  }))

  const mpdBounds =
    mpds.length > 0
      ? mpds.reduce(
          (acc, m) => {
            const x1 = m.position.x
            const y1 = m.position.y
            const x2 = m.position.x + m.dimensions.width
            const y2 = m.position.y + m.dimensions.height
            return {
              minX: Math.min(acc.minX, x1),
              minY: Math.min(acc.minY, y1),
              maxX: Math.max(acc.maxX, x2),
              maxY: Math.max(acc.maxY, y2),
            }
          },
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        )
      : null

  const canopy =
    mpdBounds
      ? {
          type: 'canopy',
          shape: 'rect',
          position: {
            x: Math.max(1, mpdBounds.minX - 2),
            y: Math.max(RULES.salesBuilding.minFrontOffset, mpdBounds.minY - 2),
          },
          dimensions: {
            width: Math.min(plot.width - 2, mpdBounds.maxX + 2) - Math.max(1, mpdBounds.minX - 2),
            height:
              Math.min(zones.middle.maxY, mpdBounds.maxY + 2) -
              Math.max(RULES.salesBuilding.minFrontOffset, mpdBounds.minY - 2),
          },
          rotation: 0,
          style: { stroke: '#111827', fill: 'transparent', dash: [0.8, 0.8] },
        }
      : null

  const mpdDetails = mpds.flatMap((m, idx) => {
    const centerX = m.position.x + m.dimensions.width / 2
    const centerY = m.position.y + m.dimensions.height / 2
    return [
      {
        type: 'mpd_dispenser',
        id: `mpd_dispenser_${idx + 1}`,
        shape: 'rect',
        position: { x: centerX - 0.35, y: centerY - 0.35 },
        dimensions: { width: 0.7, height: 0.7, cornerRadius: 0.1 },
        rotation: 0,
        style: { stroke: '#111827', fill: '#e5e7eb', dash: [] },
      },
      {
        type: 'mpd_island_centerline',
        id: `mpd_centerline_${idx + 1}`,
        shape: 'line',
        position: { x: 0, y: 0 },
        dimensions: {
          points: [
            m.position.x + 0.3,
            centerY,
            m.position.x + m.dimensions.width - 0.3,
            centerY,
          ],
        },
        rotation: 0,
        style: { stroke: '#9ca3af', fill: 'transparent', dash: [0.3, 0.3] },
      },
    ]
  })

  const tankBounds =
    tanks.length > 0
      ? tanks.reduce(
          (acc, t) => {
            const r = t.dimensions.radius
            const x1 = t.position.x - r
            const y1 = t.position.y - r
            const x2 = t.position.x + r
            const y2 = t.position.y + r
            return {
              minX: Math.min(acc.minX, x1),
              minY: Math.min(acc.minY, y1),
              maxX: Math.max(acc.maxX, x2),
              maxY: Math.max(acc.maxY, y2),
            }
          },
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        )
      : null

  const tankPit =
    tankBounds
      ? {
          type: 'tank_pit',
          shape: 'rect',
          position: { x: Math.max(0.5, tankBounds.minX - 1), y: Math.max(zones.rear.minY, tankBounds.minY - 1) },
          dimensions: {
            width: Math.min(plot.width - 0.5, tankBounds.maxX + 1) - Math.max(0.5, tankBounds.minX - 1),
            height: Math.min(plot.depth - 0.5, tankBounds.maxY + 1) - Math.max(zones.rear.minY, tankBounds.minY - 1),
          },
          rotation: 0,
          style: { stroke: '#111827', fill: 'transparent', dash: [0.6, 0.6] },
        }
      : null

  const manholes = tanks.map((t, idx) => ({
    type: 'manhole',
    id: `manhole_${idx + 1}`,
    shape: 'circle',
    position: { x: t.position.x + 2.2, y: t.position.y },
    dimensions: { radius: 0.35 },
    rotation: 0,
    style: { stroke: '#111827', fill: 'transparent', dash: [] },
  }))

  const frontKerb = (() => {
    const blockW = 1
    const blockH = 0.6
    const gap = 0.25
    const entryCenter = plot.width * 0.35
    const exitCenter = plot.width * 0.65
    const openingW = 6
    const openings = [
      { minX: entryCenter - openingW / 2, maxX: entryCenter + openingW / 2 },
      { minX: exitCenter - openingW / 2, maxX: exitCenter + openingW / 2 },
    ]

    const blocks = []
    for (let x = 0.6; x + blockW <= plot.width - 0.6; x += blockW + gap) {
      const overlaps = openings.some((o) => x < o.maxX && x + blockW > o.minX)
      if (overlaps) continue
      blocks.push({
        type: 'kerb_block',
        id: `kerb_${Math.round(x * 100)}`,
        shape: 'rect',
        position: { x, y: 0 },
        dimensions: { width: blockW, height: blockH },
        rotation: 0,
        style: { stroke: '#111827', fill: '#f3f4f6', dash: [] },
      })
    }
    return blocks
  })()

  const safetyZones = tanks.map((t, idx) => ({
    type: 'tank_safety_zone',
    id: `tank_safety_${idx + 1}`,
    shape: 'circle',
    position: { x: t.position.x, y: t.position.y },
    dimensions: { radius: 6 },
    rotation: 0,
    style: { stroke: '#ef4444', fill: 'transparent', dash: [1, 1] },
  }))

  const vent = tanks.length
    ? {
        type: 'vent',
        shape: 'rect',
        position: { x: 2, y: zones.rear.minY + 2 },
        dimensions: { width: 1.2, height: 1.2, cornerRadius: 0.2 },
        rotation: 0,
        style: { stroke: '#111827', fill: 'transparent', dash: [2, 1] },
      }
    : null

  const labels = [
    {
      type: 'label_sb',
      shape: 'label',
      position: { x: sbResult.position.x, y: Math.max(0.3, sbResult.position.y - 1.2) },
      dimensions: { width: sbResult.dimensions.width, height: 1 },
      rotation: 0,
      text: { value: 'SALES BUILDING', fontSize: 0.5, align: 'center', fill: '#111827' },
    },
    ...mpds.map((m, idx) => ({
      type: `label_mpd_${idx + 1}`,
      shape: 'label',
      position: { x: m.position.x, y: m.position.y + m.dimensions.height + 0.3 },
      dimensions: { width: m.dimensions.width, height: 1 },
      rotation: 0,
      text: { value: `MPD ${idx + 1}`, fontSize: 0.5, align: 'center', fill: '#111827' },
    })),
    ...tanks.map((t, idx) => ({
      type: `label_tank_${idx + 1}`,
      shape: 'label',
      position: { x: t.position.x - 2, y: t.position.y - t.dimensions.radius - 1.2 },
      dimensions: { width: 4, height: 1 },
      rotation: 0,
      text: { value: `UG TANK ${idx + 1}`, fontSize: 0.5, align: 'center', fill: '#111827' },
    })),
  ]

  const roadLabels =
    roadType === 'City'
      ? [
          {
            type: 'label_road',
            shape: 'label',
            position: { x: 0, y: 0.1 },
            dimensions: { width: plot.width, height: 1 },
            rotation: 0,
            text: { value: 'CITY ROAD', fontSize: 0.5, align: 'center', fill: '#111827' },
          },
        ]
      : [
          {
            type: 'label_acc',
            shape: 'label',
            position: { x: 0, y: 0.2 },
            dimensions: { width: plot.width, height: 1 },
            rotation: 0,
            text: {
              value: `${roadType} ACC ${RULES.roadType[roadType].accelerationLane}m`,
              fontSize: 0.45,
              align: 'left',
              fill: '#111827',
            },
          },
          {
            type: 'label_dec',
            shape: 'label',
            position: { x: 0, y: 0.8 },
            dimensions: { width: plot.width, height: 1 },
            rotation: 0,
            text: {
              value: `${roadType} DEC ${RULES.roadType[roadType].decelerationLane}m`,
              fontSize: 0.45,
              align: 'left',
              fill: '#111827',
            },
          },
          {
            type: 'label_taper',
            shape: 'label',
            position: { x: 0, y: 1.4 },
            dimensions: { width: plot.width, height: 1 },
            rotation: 0,
            text: {
              value: `${roadType} TAPER ${RULES.roadType[roadType].taper}m`,
              fontSize: 0.45,
              align: 'left',
              fill: '#111827',
            },
          },
        ]

  return ok({
    draw: [
      plotOutline,
      ...zoneGuides,
      roadCenterLine,
      ...entryExitCurves,
      ...frontKerb,
      ...(canopy ? [canopy] : []),
      salesBuildingDraw,
      ...salesBuildingDetails,
      ...mpds,
      ...mpdDetails,
      ...tankClearanceRings,
      ...tanks,
      ...(tankPit ? [tankPit] : []),
      ...manholes,
      ...safetyZones,
      ...(vent ? [vent] : []),
      ...labels,
      ...roadLabels,
    ],
  })
}

/*
Example usage:

const input = {
  plot: { width: 30, depth: 40 },
  roadType: "NH",
  salesBuilding: { type: "SB Type 3", orientation: "front", position: "front_center" },
  tanks: { count: 2 },
  mpds: { count: 4 }
}

const result = generateKonvaDrawData(input)
if (!result.valid) console.error(result.error)
else console.log(result.draw)
*/
