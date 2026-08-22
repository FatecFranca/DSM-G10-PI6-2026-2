import {
  classifyBatch,
  classifyOne,
  getFeatureContract,
} from './classification.service.js';

export async function postClassify(req, res, next) {
  try {
    res.json(await classifyOne(req.body));
  } catch (error) {
    next(error);
  }
}

export async function postClassifyBatch(req, res, next) {
  try {
    res.json(await classifyBatch(req.body));
  } catch (error) {
    next(error);
  }
}

export async function getFeatures(req, res, next) {
  try {
    res.json(await getFeatureContract());
  } catch (error) {
    next(error);
  }
}
