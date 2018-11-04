let http = require('http').createServer().listen(3000)
let io = require('socket.io')(http)

const Player = require('./player')

console.log('Started io server...')

const allPlayers = []

const getPlayerNameList = () => allPlayers.map(p => p.nickname)

let serverGameState = {title: 'Waiting for other players', type: 'wait'}

function sendTickUpdate() {

  //Create network player array form allplayers
  let networkPlayers = allPlayers.map(p => {
    return {name : p.nickname, pos: p.pos, dir: p.dir, alive: p.alive}}) // todo path only last 10
    io.emit('gameTick', {players: networkPlayers})
}

let gameLoopInterval

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

    let colorMap = {}

    for(let p of allPlayers) {
      colorMap[p.nickname] = p.color
      //setup
      p.alive = true
      p.path = []
    }

    serverGameState = {title: 'In Game', type: 'Play', colors: colorMap}

    //give every player a uniqe starting point
    for(let p of allPlayers) {
      let privateState = JSON.parse(JSON.stringify(serverGameState))
      privateState.startPos = {x: Math.random() * 80 + 10, y: Math.random() * 80 + 10}
      p.pos = privateState.startPos
      privateState.startDir = p.dir
      p.socket.emit('gameState', privateState)
    }
    gameLoopInterval = setInterval(sendTickUpdate, 30)
  }

  else if(state == 'GameOver' && serverGameState != 'GameOver') {
    serverGameState = {title: 'Game Over', type: 'GameOver', winner: lastWinner.nickname}
    
    //send to all players the gameover event
    io.emit('gameState', serverGameState)


    //set timeout for reset
    setTimeout(() => {
      setServerGameState('Countdown')
    }, 1000 * 5)

  }
  else if(state == 'Waiting') {
    serverGameState = {title: 'Waiting...', type: 'wait'}
  }

  console.log('new gameState')
  console.log(serverGameState)
}


//SOCKET IO MAINPART
io.on('connection', socket => {
  console.log('New Socket connection')
  let thisPlayer
  socket.on('join', nick => thisPlayer = join(socket, nick))
  socket.on('playerTick', tickData => onPlayerTickUpdate(socket, tickData))
  socket.on('disconnect', () => {
    allPlayers.splice(allPlayers.indexOf(thisPlayer), 1)
    console.log(thisPlayer.nickname + ' disconnected')

    if(allPlayers.length < 2) setServerGameState('Waiting')
  })
})



const colors = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2']

/**
 * 
 * @param {SocketIO.Socket} socket 
 * @param {String} nickname 
 */
function join(socket, nickname) {
  console.log('New player ' + nickname + ' tries to join')
  if (!allPlayers.every(p => p.nickname != nickname)) {
    socket.emit('joinresponse', { serverID: 's', valid: false })
    return undefined
  }
  let newPlayer = new Player(nickname, socket, colors[allPlayers.length])
  allPlayers.push(newPlayer)
  socket.emit('joinresponse', { serverID: 's', valid: true , color: newPlayer.color})
  if(allPlayers.length == 2) {
    setServerGameState('Countdown')
  }
  return newPlayer
}

function onPlayerTickUpdate(socket, data) {
  //get player on the server
  let serverPlayer = allPlayers.find(p => socket == p.socket)
  if(serverPlayer == null) return //TODO error
  serverPlayer.update(data)

  //calculate collisions
  //bb
  const pos = serverPlayer.pos
  if(pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) {
    serverPlayer.alive = false
    checkWinner()
    return
  }
  if(serverPlayer.path.length < 2) return
  const p1 = serverPlayer.path[serverPlayer.path.length - 1]
  const p2 = serverPlayer.path[serverPlayer.path.length - 2]
  const moveSeg = new Line(p1, p2)
  //against other paths
  for(let player of allPlayers) {
    let sub = 1
    if(player.nickname == serverPlayer.nickname )sub = 10
    for(let i = 0; i < player.path.length - sub; i++) {
      const pSeg = new Line({x: player.path[i].x, y: player.path[i].y}, {x: player.path[i + 1].x, y: player.path[i + 1].y})
      if(doIntersect(pSeg, moveSeg)) {
        console.log('intersection of ' + serverPlayer.nickname)
        serverPlayer.alive = false
        checkWinner()
        return
      }
    }
  }
}

let lastWinner

function checkWinner() {
  let totalPlayersAlive = allPlayers.reduce((p, c) => p += c.alive ? 1 : 0, 0)
  if(totalPlayersAlive == 1) {
    //Get winner
    let winner = allPlayers.find(p => p.alive)
    clearInterval(gameLoopInterval)
    lastWinner = winner
    setServerGameState('GameOver')
  }
}


//Line Line intersection alternative by https://martin-thoma.com/how-to-check-if-two-line-segments-intersect/

//line segment intersection by https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/

class Line {
  constructor(p1, p2) {
    this.p1 = p1
    this.p2 = p2
  }
}

function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)

  if(val == 0)return 0 // collinear
  return (val > 0) ? 1 : 2
}


/**
 * 
 * @param {{x: number, y: number}} p 
 * @param {{x: number, y: number}} q 
 * @param {{x: number, y: number}} r 
 * @returns {bool} if line is on 
 */
function onSegment(p, q, r) {
  if (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && 
        q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)) 
       {return true}
  
  else return false
}

/**
 * 
 * @param {Line} a 
 * @param {Line} b 
 */
function doIntersect(a, b) {
  const o1 = orientation(a.p1, a.p2, b.p1)
  const o2 = orientation(a.p1, a.p2, b.p2)
  const o3 = orientation(b.p1, b.p2, a.p1)
  const o4 = orientation(b.p1, b.p2, a.p2)


  //general
  if(o1 != o2 && o3 != o4) return true

  // Special Cases 
  // p1, q1 and p2 are colinear and p2 lies on segment p1q1 
  if (o1 == 0 && onSegment(a.p1, b.p1, a.p2)) return true

  // p1, q1 and q2 are colinear and q2 lies on segment p1q1 
  if (o2 == 0 && onSegment(a.p1, b.p2, a.p2)) return true

  // p2, q2 and p1 are colinear and p1 lies on segment p2q2 
  if (o3 == 0 && onSegment(b.p1, a.p1, b.p2)) return true

    // p2, q2 and q1 are colinear and q1 lies on segment p2q2 
  if (o4 == 0 && onSegment(b.p1, a.p2, b.p2)) return true
  
  return false
}