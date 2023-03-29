const OBSWebSocket = require('obs-websocket-js')
const OBSWebSocketNew = require('obs-websocket-js-new').default
const osc = require('node-osc')
const fs = require('fs')
const ini = require('ini')
const path = require('path')
const consola = require('consola')
const Box = require('cli-box')
const { getOBSStreamStatus, getOBSSceneList, setOBSScene, setOBSStream, getOBSScene } = require('./utils/obs.js')
const axios = require('axios')
const { version } = require('./package.json')

/* Read configs */
const config = {
  vrchat: {
    client_ip: '127.0.0.1',
    client_port: '9000',
    server_ip: '0.0.0.0',
    server_port: '9001'
  },
  obs: {
    version: '5',
    ip: '127.0.0.1',
    port: '4455',
    password: ''
  }
}
const cfgPath = process.env.NODE_ENV === 'dev' ? './config.ini' : path.join(path.dirname(process.execPath), './config.ini')
const cfgExists = fs.existsSync(cfgPath)
if (!cfgExists) {
  consola.error('Config file not found, creating one...')
  fs.writeFileSync(cfgPath, ini.stringify(config))
} else {
  const parsedConfig = ini.parse(fs.readFileSync(cfgPath, 'utf-8'))
  config.vrchat.client_ip = parsedConfig?.vrchat?.client_ip || '127.0.0.1'
  config.vrchat.client_port = parsedConfig?.vrchat?.client_port || '9000'
  config.vrchat.server_ip = parsedConfig?.vrchat?.server_ip || '0.0.0.0'
  config.vrchat.server_port = parsedConfig?.vrchat?.server_port || '9001'
  config.obs.version = parsedConfig?.obs?.version || '4'
  config.obs.ip = parsedConfig?.obs?.ip || '127.0.0.1'
  config.obs.port = parsedConfig?.obs?.port || '4455'
  config.obs.password = parsedConfig?.obs?.password || ''
}

const main = async () => {
  try {
    /* Check version */
    const check = await axios.get('https://api.github.com/repos/rogeraabbccdd/VRChat-OBSOSC/releases').catch(e => undefined)
    if (check && check.data[0] && check.data[0].tag_name !== 'v' + version) {
      const box = Box('60x3', `New version available: ${check.data[0].tag_name}\nhttps://github.com/rogeraabbccdd/VRChat-OBSOSC/releases\nhttps://kento520.booth.pm/items/4652397`)
      console.log(box.toString())
    }

    /* OBS Websocket */
    consola.info(`Connecting to OBS at ${config.obs.ip}:${config.obs.port}...`)
    const obs = config.obs.version === '4' ? new OBSWebSocket() : new OBSWebSocketNew()
    if (obs instanceof OBSWebSocket) await obs.connect({ address: `${config.obs.ip}:${config.obs.port}`, password: config.obs.password })
    else await obs.connect(`ws://${config.obs.ip}:${config.obs.port}`, config.obs.password)
    consola.success(`OBS connected to ${config.obs.ip}:${config.obs.port}`)

    /* VRChat OSC */
    const server = new osc.Server(config.vrchat.server_port, config.vrchat.server_ip)
    consola.success(`OSC server started at ${config.vrchat.server_ip}:${config.vrchat.server_port}`)
    const client = new osc.Client(config.vrchat.client_ip, config.vrchat.client_port)
    consola.success(`OSC client started at ${config.vrchat.client_ip}:${config.vrchat.client_port}`)

    /* Detect OBS streaming status and set avatar parameters on startup */
    const streaming = await getOBSStreamStatus(obs)
    consola.info('OBS streaming status: ' + streaming)
    if (streaming) client.send('/avatar/parameters/stream', 1)
    else client.send('/avatar/parameters/stream', 0)

    /* Detect OBS current scene and set avatar parameters on startup */
    const scene = await getOBSScene(obs)
    const scenes = await getOBSSceneList(obs)
    consola.info('OBS current scene: ' + scene)
    client.send('/avatar/parameters/scene', scenes.indexOf(scene))

    /* OBS events */
    if (obs instanceof OBSWebSocket) {
      obs.on('StreamStarting', () => {
        consola.info('OBS streaming started')
        client.send('/avatar/parameters/stream', 1)
      })
      obs.on('StreamStopping', () => {
        consola.info('OBS streaming stopped')
        client.send('/avatar/parameters/stream', 0)
      })
      obs.on('SwitchScenes', async ({ 'scene-name': sceneName }) => {
        consola.info('OBS scene changed to ' + sceneName)
        const scenes = await getOBSSceneList(obs)
        client.send('/avatar/parameters/scene', scenes.indexOf(sceneName))
      })
    } else {
      obs.on('StreamStateChanged', ({ outputActive, outputState }) => {
        if (outputState === 'OBS_WEBSOCKET_OUTPUT_STARTING' || outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPING') return
        consola.info('OBS streaming status: ' + outputActive)
        if (outputActive) client.send('/avatar/parameters/stream', 1)
        else client.send('/avatar/parameters/stream', 0)
      })
      obs.on('CurrentProgramSceneChanged', async ({ sceneName }) => {
        consola.info('OBS scene changed to ' + sceneName)
        const scenes = await getOBSSceneList(obs)
        client.send('/avatar/parameters/scene', scenes.indexOf(sceneName))
      })
    }

    /* OSC events */
    server.on('/avatar/parameters/scene', async (data) => {
      consola.info('Avatar scene changed to ' + data[1])
      const scenes = await getOBSSceneList(obs)
      const scene = await getOBSScene(obs)
      if (scenes.indexOf(scene) !== data[1]) setOBSScene(obs, scenes[data[1]])
    })
    server.on('/avatar/parameters/stream', async (data) => {
      consola.info('Avatar streaming status changed to ' + data[1])
      const streaming = await getOBSStreamStatus(obs)
      if (data[1] === streaming) return
      if (data[1]) setOBSStream(obs, true)
      else setOBSStream(obs, false)
    })
  } catch (error) {
    consola.error(error)
    if (process.stdin.isTTY) {
      console.log('=================================== \n')
      console.log('Press any key to exit.')
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.on('data', process.exit.bind(process, 0))
    }
  }
}

main()
