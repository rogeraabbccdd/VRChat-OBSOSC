const OBSWebSocket = require('obs-websocket-js')

const getOBSStreamStatus = async (obs) => {
  if (obs instanceof OBSWebSocket) {
    const { streaming } = await obs.send('GetStreamingStatus')
    return streaming
  } else {
    const { outputActive } = await obs.call('GetStreamStatus')
    return outputActive
  }
}

const getOBSSceneList = async (obs) => {
  if (obs instanceof OBSWebSocket) {
    const { scenes } = await obs.send('GetSceneList')
    return scenes.map(scene => scene.name)
  } else {
    const { scenes } = await obs.call('GetSceneList')
    return scenes.map(scene => scene.sceneName).reverse()
  }
}

const setOBSScene = (obs, name) => {
  if (obs instanceof OBSWebSocket) obs.send('SetCurrentScene', { 'scene-name': name })
  else obs.call('SetCurrentProgramScene', { sceneName: name })
}

const setOBSStream = (obs, straming) => {
  if (obs instanceof OBSWebSocket) {
    if (straming) obs.send('StartStreaming')
    else obs.send('StopStreaming')
  } else {
    if (straming) obs.call('StartStream')
    else obs.call('StopStream')
  }
}

const getOBSScene = async (obs) => {
  if (obs instanceof OBSWebSocket) {
    const { name } = await obs.send('GetCurrentScene')
    return name
  } else {
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene')
    return currentProgramSceneName
  }
}

module.exports = {
  getOBSStreamStatus,
  getOBSSceneList,
  setOBSScene,
  setOBSStream,
  getOBSScene
}
