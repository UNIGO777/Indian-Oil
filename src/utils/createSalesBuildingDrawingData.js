export function createSalesBuildingDrawingData(input) {
  const sbType = input?.salesBuildingType
  const orientation = input?.orientation
  const positionPreference = input?.positionPreference
  const entrySide = input?.entrySide
  const style = input?.style

  const plotWidth = 30
  const y = 2
  const marginX = 2

  const sbDimensionsByType = {
    'SB Type 1': { width: 4, depth: 5 },
    'SB Type 2': { width: 6, depth: 6 },
    'SB Type 3': { width: 8, depth: 7 },
    'SB Type 4': { width: 10, depth: 8 },
    'SB Type 5': { width: 12, depth: 9 },
  }

  const fillByStyle = {
    light_grey: '#e5e7eb',
    blue: '#2563eb',
    white: '#ffffff',
  }

  const dimensions = sbDimensionsByType[sbType] ?? { width: 0, depth: 0 }
  const rotation = orientation === 'side' ? 90 : 0

  let x = marginX
  if (positionPreference === 'front_center') {
    x = (plotWidth - dimensions.width) / 2
  } else if (positionPreference === 'front_right') {
    x = plotWidth - dimensions.width - marginX
  }

  return {
    type: 'sales_building',
    shape: 'rect',
    dimensions: {
      width: dimensions.width,
      height: dimensions.depth,
    },
    position: {
      x,
      y,
    },
    rotation,
    style: {
      fill: fillByStyle[style] ?? fillByStyle.light_grey,
      stroke: 'black',
    },
    entry: {
      direction: entrySide === 'inside' ? 'down' : 'up',
    },
  }
}

