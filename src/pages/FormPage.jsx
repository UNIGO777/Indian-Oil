import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSalesBuildingDrawingData } from '../utils/createSalesBuildingDrawingData.js'
import { generateKonvaDrawData, validateLayout } from '../utils/ioclLayoutEngine.js'

function FormPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const salesBuildingOptions = [
    { value: 'SB Type 1', name: 'Compact', width: 4, depth: 5 },
    { value: 'SB Type 2', name: 'Standard', width: 6, depth: 6 },
    { value: 'SB Type 3', name: 'Plus', width: 8, depth: 7 },
    { value: 'SB Type 4', name: 'Premium', width: 10, depth: 8 },
    { value: 'SB Type 5', name: 'Grande', width: 12, depth: 9 },
  ]

  const handleSubmit = (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const payload = {
      location: {
        latitude: Number(formData.get('latitude')),
        longitude: Number(formData.get('longitude')),
      },
      roadType: String(formData.get('roadType')),
      plot: {
        frontage: Number(formData.get('plotFrontage')),
        depth: Number(formData.get('plotDepth')),
      },
      tanks: {
        count: Number(formData.get('tankCount')),
        installationType: String(formData.get('tankInstallationType')),
      },
      salesBuildingType: String(formData.get('salesBuildingType')),
      mpds: Number(formData.get('mpds')),
    }

    console.log(payload)

    const roadType = payload.roadType === 'City Road' ? 'City' : payload.roadType

    const layoutInput = {
      plot: { width: payload.plot.frontage, depth: payload.plot.depth },
      roadType,
      salesBuilding: {
        type: payload.salesBuildingType,
        orientation: String(formData.get('sbOrientation')),
        position: String(formData.get('sbPositionPreference')),
        entrySide: String(formData.get('sbEntrySide')),
      },
      tanks: { count: payload.tanks.count },
      mpds: { count: payload.mpds },
    }

    const validation = validateLayout(layoutInput)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setError('')
    sessionStorage.setItem('ioclLayoutInput', JSON.stringify(layoutInput))

    const salesBuildingDrawing = createSalesBuildingDrawingData({
      salesBuildingType: payload.salesBuildingType,
      orientation: String(formData.get('sbOrientation')),
      positionPreference: String(formData.get('sbPositionPreference')),
      entrySide: String(formData.get('sbEntrySide')),
      style: String(formData.get('sbVisualStyle')),
    })

    console.log(salesBuildingDrawing)

    const scene = generateKonvaDrawData(layoutInput)
    console.log(scene)

    navigate('/draw')
  }

  const inputBase =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10'

  const labelBase = 'block text-sm font-medium text-slate-800'

  const fieldsetBase =
    'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Input Collection Demo
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Fill all fields and submit. The final payload is logged as a single
            JSON object in the browser console.
          </p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">Location</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="latitude">
                  Latitude
                </label>
                <input
                  className={inputBase}
                  id="latitude"
                  name="latitude"
                  required
                  step="any"
                  type="number"
                />
              </div>

              <div>
                <label className={labelBase} htmlFor="longitude">
                  Longitude
                </label>
                <input
                  className={inputBase}
                  id="longitude"
                  name="longitude"
                  required
                  step="any"
                  type="number"
                />
              </div>
            </div>
          </section>

          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">Road</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="roadType">
                  Road Type
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="roadType"
                  name="roadType"
                  required
                >
                  <option disabled value="">
                    Select road type
                  </option>
                  <option value="NH">NH (National Highway)</option>
                  <option value="SH">SH (State Highway)</option>
                  <option value="City">City Road (Urban)</option>
                </select>
              </div>
            </div>
          </section>

          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">Plot</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="plotFrontage">
                  Plot Frontage (meters)
                </label>
                <input
                  className={inputBase}
                  id="plotFrontage"
                  name="plotFrontage"
                  required
                  step="any"
                  type="number"
                />
              </div>

              <div>
                <label className={labelBase} htmlFor="plotDepth">
                  Plot Depth (meters)
                </label>
                <input
                  className={inputBase}
                  id="plotDepth"
                  name="plotDepth"
                  required
                  step="any"
                  type="number"
                />
              </div>
            </div>
          </section>

          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">Tanks</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="tankCount">
                  Number of Underground Tanks
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="tankCount"
                  name="tankCount"
                  required
                >
                  <option disabled value="">
                    Select tank count
                  </option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>

              <div>
                <label className={labelBase} htmlFor="tankInstallationType">
                  Tank Installation Type
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="tankInstallationType"
                  name="tankInstallationType"
                  required
                >
                  <option disabled value="">
                    Select installation type
                  </option>
                  <option value="Earth Pit">Earth Pit</option>
                  <option value="Masonry Pit">Masonry Pit</option>
                </select>
              </div>
            </div>
          </section>

          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">Sales Building</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="salesBuildingType">
                  Sales Building Type
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="salesBuildingType"
                  name="salesBuildingType"
                  required
                >
                  <option disabled value="">
                    Select sales building type
                  </option>
                  {salesBuildingOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.name} — {opt.value} ({opt.width}m × {opt.depth}m)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">Sales Building (Drawing)</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="sbOrientation">
                  Orientation
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="sbOrientation"
                  name="sbOrientation"
                  required
                >
                  <option disabled value="">
                    Select orientation
                  </option>
                  <option value="front">front</option>
                  <option value="side">side</option>
                </select>
              </div>

              <div>
                <label className={labelBase} htmlFor="sbPositionPreference">
                  Position Preference
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="sbPositionPreference"
                  name="sbPositionPreference"
                  required
                >
                  <option disabled value="">
                    Select position
                  </option>
                  <option value="front_left">front_left</option>
                  <option value="front_center">front_center</option>
                  <option value="front_right">front_right</option>
                </select>
              </div>

              <div>
                <label className={labelBase} htmlFor="sbEntrySide">
                  Entry Side
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="sbEntrySide"
                  name="sbEntrySide"
                  required
                >
                  <option disabled value="">
                    Select entry side
                  </option>
                  <option value="road">road</option>
                  <option value="inside">inside</option>
                </select>
              </div>

              <div>
                <label className={labelBase} htmlFor="sbVisualStyle">
                  Visual Style
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="sbVisualStyle"
                  name="sbVisualStyle"
                  required
                >
                  <option disabled value="">
                    Select style
                  </option>
                  <option value="light_grey">light_grey</option>
                  <option value="blue">blue</option>
                  <option value="white">white</option>
                </select>
              </div>
            </div>
          </section>

          <section className={fieldsetBase}>
            <h2 className="text-base font-semibold">MPDs</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelBase} htmlFor="mpds">
                  Number of MPDs
                </label>
                <select
                  className={inputBase}
                  defaultValue=""
                  id="mpds"
                  name="mpds"
                  required
                >
                  <option disabled value="">
                    Select MPDs
                  </option>
                  <option value="2">2</option>
                  <option value="4">4</option>
                </select>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              All fields are required. Submit logs JSON to console.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              type="submit"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default FormPage
