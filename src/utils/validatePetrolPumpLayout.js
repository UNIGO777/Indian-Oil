/**
 * Validates whether the given input data is sufficient and suitable to generate a petrol pump layout.
 *
 * Return format:
 * - { valid: true }
 * - { valid: false, error: "reason" }
 *
 * @param {object} data
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validatePetrolPumpLayout(data) {
  const fail = (error) => ({ valid: false, error })

  if (!data || typeof data !== 'object') {
    return fail('Invalid input data')
  }

  const latitude = data?.location?.latitude
  const longitude = data?.location?.longitude
  const roadTypeRaw = data?.roadType
  const plotFrontage = data?.plot?.frontage
  const plotDepth = data?.plot?.depth
  const tankCount = data?.tanks?.count
  const tankInstallationType = data?.tanks?.installationType
  const salesBuildingType = data?.salesBuildingType
  const mpds = data?.mpds

  const isFiniteNumber = (value) =>
    typeof value === 'number' && Number.isFinite(value)

  const coerceRoadType = (value) => {
    if (value === 'City Road') return 'City'
    return value
  }

  const roadType = coerceRoadType(roadTypeRaw)

  const allowedRoadTypes = new Set(['NH', 'SH', 'City'])
  const allowedTankCounts = new Set([1, 2, 3])
  const allowedTankInstallationTypes = new Set(['Earth Pit', 'Masonry Pit'])
  const allowedSalesBuildingTypes = new Set([
    'SB Type 1',
    'SB Type 2',
    'SB Type 3',
    'SB Type 4',
    'SB Type 5',
  ])
  const allowedMpds = new Set([2, 4])

  const salesBuildingDepthByType = {
    'SB Type 1': 5,
    'SB Type 2': 6,
    'SB Type 3': 7,
    'SB Type 4': 8,
    'SB Type 5': 9,
  }

  const tankZoneMinDepth = 10
  const safetyBufferDepth = 5
  const mpdWidthMeters = 4

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return fail('Latitude & Longitude must be valid numbers')
  }

  if (!isFiniteNumber(plotFrontage) || plotFrontage <= 0) {
    return fail('Plot frontage must be greater than 0')
  }

  if (!isFiniteNumber(plotDepth) || plotDepth <= 0) {
    return fail('Plot depth must be greater than 0')
  }

  if (!allowedRoadTypes.has(roadType)) {
    return fail('Road Type must be selected')
  }

  if (!allowedTankCounts.has(tankCount)) {
    return fail('Number of Underground Tanks must be selected')
  }

  if (!allowedTankInstallationTypes.has(tankInstallationType)) {
    return fail('Tank Installation Type must be selected')
  }

  if (!allowedSalesBuildingTypes.has(salesBuildingType)) {
    return fail('Sales Building Type must be selected')
  }

  if (!allowedMpds.has(mpds)) {
    return fail('Number of MPDs must be selected')
  }

  if (plotFrontage < 20 || plotDepth < 30) {
    return fail('Plot size too small for petrol pump layout')
  }

  const sbDepth = salesBuildingDepthByType[salesBuildingType]
  if (sbDepth + tankZoneMinDepth + safetyBufferDepth > plotDepth) {
    return fail('Selected Sales Building and tanks cannot fit in given plot depth')
  }

  if (mpds * mpdWidthMeters > plotFrontage) {
    return fail('Frontage too small for selected number of MPDs')
  }

  if ((roadType === 'NH' || roadType === 'SH') && plotDepth < 35) {
    return fail('Plot depth insufficient for highway layout')
  }

  return { valid: true }
}

/**
 * Example usage:
 *
 * const input = {
 *   location: { latitude: 28.61, longitude: 77.21 },
 *   roadType: "NH",
 *   plot: { frontage: 30, depth: 40 },
 *   tanks: { count: 2, installationType: "Earth Pit" },
 *   salesBuildingType: "SB Type 3",
 *   mpds: 4
 * }
 *
 * const result = validatePetrolPumpLayout(input)
 * if (!result.valid) console.error(result.error)
 */

