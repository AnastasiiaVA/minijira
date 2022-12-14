const Validator = require('async-validator').default
const socketServer = require('../socket-connection')

const Panel = require('../models/panel')

exports.createPanel = async (req, res, next) => {
  const descriptor = {
    title: [
      { required: true, message: 'Panel title is required.\n' },
      { min: 3, message: 'Panel title should have a minimum length of 3 characters.\n' },
      { max: 200, message: 'Panel title should have a maximum length of 200 characters.\n' }
    ]
  }

  const validator = new Validator(descriptor)

  const panelRequest = {
    title: req.body.title
  }

  try {
    await validator.validate(panelRequest)
  } catch ({ errors }) {
    return next({ message: errors.map(e => e.message).join('') })
  }

  let panel = new Panel(panelRequest)

  try {
    panel.save()

    req.user.panels.push(panel)
    await req.user.save()

    res.status(200).send(panel)
  } catch (e) {
    return next(e)
  }
}

exports.getPanel = async (req, res, next) => {
  let panel

  try {
    panel = await Panel.findById(req.params.panelId)

    res.status(200).send(panel)
  } catch (e) {
    return next(new Error('Panel not found'))
  }
}

exports.createList = async (req, res, next) => {
  let panel

  const list = {
    title: req.body.title,
    createdBy: req.session.userId
  }

  try {
    panel = await Panel.findById(req.params.panelId)

    panel.lists.push(list)
    panel.save()

    socketServer().to(req.params.panelId).emit('panel updated')

    res.sendStatus(200)
  } catch (e) {
    return next(e)
  }
}

exports.createCard = async (req, res, next) => {
  let panel

  try {
    panel = await Panel.findOne({ _id: req.params.panelId })

    let list = panel.lists.find(l => l._id == req.params.listId)

    list.cards.push({ title: req.body.title, createdBy: req.session.userId })

    await panel.save()

    socketServer().to(req.params.panelId).emit('panel updated')

    res.sendStatus(200)
  } catch (e) {
    return next(e)
  }
}

exports.updateCard = async (req, res, next) => {
  const update = {
    '$set': {
      'lists.$[list].cards.$[card]': req.body.card
    }
  }

  const panel = await Panel.findOneAndUpdate(
    {
      _id: req.params.panelId,
    },
    update,
    { arrayFilters: [{ 'list._id': req.params.listId }, { 'card._id': req.params.cardId }], new: true }
  )

  if (!panel) return next(new Error('Card not found'))

  await panel.save()

  try {
    socketServer().to(req.params.panelId).emit('panel updated')

    res.sendStatus(200)
  } catch (error) {
    return next(new Error('asd'))
  }
}

exports.updateCardsOfList = async (req, res, next) => {
  try {
    let panel = await Panel.findById(req.params.panelId)

    let list = await panel.lists.find(l => l._id == req.params.listId)

    let card = list.cards[req.body.oldIndex]

    list.cards.splice(req.body.oldIndex, 1)
    list.cards.splice(req.body.newIndex, 0, card)

    await panel.save()

    socketServer().to(req.params.panelId).emit('panel updated')

    res.sendStatus(200)
  } catch (e) {
    return next(e)
  }
}

exports.updateCardsBetweenLists = async (req, res, next) => {
  try {
    let panel = await Panel.findById(req.params.panelId)

    let fromList = await panel.lists.find(l => l._id == req.body.fromListId)
    let toList = panel.lists.find(l => l._id == req.body.toListId)

    let card = fromList.cards[req.body.oldIndex]

    toList.cards.splice(req.body.newIndex, 0, card)
    fromList.cards.splice(req.body.oldIndex, 1);

    await panel.save()

    socketServer().to(req.params.panelId).emit('panel updated')

    res.sendStatus(200)
  } catch (e) {
    return next(e)
  }
}
