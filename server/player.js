class Player {
  constructor(nickname, socket) {
    this.nickname = nickname
    this.socket = socket
    this.pos = {x: 0, y:0}
    this.path = []
    this.dir = Math.random() * Math.PI * 2
  }

  update(tickData) {
    this.pos = tickData.pos
    //dont get path ... server is source of truth

    this.dir = tickData.dir
    this.path.push({x: tickData.pos.x, y: tickData.pos.y, id: tickData.tickID})
  }
}


module.exports = Player