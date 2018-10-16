let http = require('http').createServer().listen(3000)
let io = require('socket.io')(http)

const Player = require('./player')

console.log('Started io server...')

const allPlayers = []

const getPlayerNameList = () => allPlayers.map(p => p.nickname)

let serverGameState = {title: 'Waiting for other players'}

function sendTickUpdate() {

  //Create network player array form allplayers
  let networkPlayers = allPlayers.map(p => {
    return {name : p.nickname, pos: p.pos, dir: p.dir}}) // todo path only last 10
    io.emit('gameTick', {players: networkPlayers})
}

function setServerGameState(state) {
  if(state == 'Countdown' && serverGameState.type != 'Countdown') {
    serverGameState = {title: 'Countdown - players can still join', type: 'Countdown', counter: 5, players: getPlayerNameList()}

    const interval = setInterval(() => {
      if(serverGameState.counter && serverGameState.counter > 1) {
        serverGameState.counter--

        io.emit('gameState', serverGameState)
      }
      else {
        clearInterval(interval)
        setServerGameState('Play')
      }
    }, 1000)
    io.emit('gameState', serverGameState)
  }
  else if(state == 'Play' && serverGameState != 'Play') {
    serverGameState = {title: 'In Game', type: 'Play'}

    //give every player a uniqe starting point
    for(let p of allPlayers) {
      let privateState = JSON.parse(JSON.stringify(serverGameState))
      privateState.startPos = {x: Math.random() * 100, y: Math.random() * 100}
      p.pos = privateState.startPos
      privateState.startDir = p.dir
      p.socket.emit('gameState', privateState)
      setInterval(sendTickUpdate, 30)
    }
  }

}

io.on('connection', socket => {
  console.log('New Socket connection')

  socket.on('join', nick => join(socket, nick))
  socket.on('playerTick', tickData => onPlayerTickUpdate(socket, tickData))
})



/**
 * 
 * @param {SocketIO.Socket} socket 
 * @param {String} nickname 
 */
function join(socket, nickname) {
  console.log('New player ' + nickname + ' tries to join')
  if (!allPlayers.every(p => p.nickname != nickname)) {
    socket.emit('joinresponse', { serverID: 's', valid: false })
  }
  let newPlayer = new Player(nickname, socket)
  allPlayers.push(newPlayer)
  socket.emit('joinresponse', { serverID: 's', valid: true })
  if(allPlayers.length == 2) {
    setServerGameState('Countdown')
  }
}

function onPlayerTickUpdate(socket, data) {
  //get player on the server
  let serverPlayer = allPlayers.find(p => socket == p.socket)
  if(serverPlayer == null) return //TODO error
  serverPlayer.update(data)
}