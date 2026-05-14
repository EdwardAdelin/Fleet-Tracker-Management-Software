import axios from 'axios';
import { calculateHaversineDistance } from '../utils/geoUtils';

type Location = { lat: number; lng: number };

type TaskWithLocation = {
  id: number;
  lat: number;
  lng: number;
  [key: string]: any;
};

export const calculateGreedyRoute = (
  startLocation: Location,
  tasks: TaskWithLocation[],
) => {
  const remaining = [...tasks];
  const route: TaskWithLocation[] = [];
  let currentLocation = { ...startLocation };
  let totalDistance = 0;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateHaversineDistance(
      currentLocation.lat,
      currentLocation.lng,
      remaining[0].lat,
      remaining[0].lng,
    );

    for (let i = 1; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const distance = calculateHaversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        candidate.lat,
        candidate.lng,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nextTask = remaining.splice(nearestIndex, 1)[0];
    route.push(nextTask);
    totalDistance += nearestDistance;
    currentLocation = { lat: nextTask.lat, lng: nextTask.lng };
  }

  if (route.length > 0) {
    totalDistance += calculateHaversineDistance(
      currentLocation.lat,
      currentLocation.lng,
      startLocation.lat,
      startLocation.lng,
    );
  }

  return { route, totalDistance };
};

export const calculateDrivingDistanceForOrder = async (
  startLocation: Location,
  orderedTasks: TaskWithLocation[],
) => {
  if (!Array.isArray(orderedTasks) || orderedTasks.length === 0) {
    return 0;
  }

  const origin = `${startLocation.lat},${startLocation.lng}`;
  const destination = origin;
  const waypoints = orderedTasks.map((task) => `${task.lat},${task.lng}`).join('|');

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_MAPS_API_KEY');
  }

  const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
    params: {
      origin,
      destination,
      waypoints,
      key: apiKey,
      mode: 'driving',
    },
  });

  const data = response.data;
  if (data.status !== 'OK' || !data.routes?.length) {
    throw new Error(
      `Google Directions API error: ${data.status} ${data.error_message ?? ''}`.trim(),
    );
  }

  const routeData = data.routes[0];
  const totalMeters = routeData.legs.reduce(
    (sum: number, leg: any) => sum + (leg.distance?.value ?? 0),
    0,
  );

  return totalMeters / 1000;
};

export const calculateGoogleRoute = async (
  startLocation: Location,
  tasks: TaskWithLocation[],
) => {
  if (tasks.length === 0) {
    return { route: [], totalDistance: 0 };
  }

  const origin = `${startLocation.lat},${startLocation.lng}`;
  const destination = origin;
  const waypoints = [
    'optimize:true',
    ...tasks.map((task) => `${task.lat},${task.lng}`),
  ].join('|');

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_MAPS_API_KEY');
  }

  const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
    params: {
      origin,
      destination,
      waypoints,
      key: apiKey,
      mode: 'driving',
    },
  });

  const data = response.data;
  if (data.status !== 'OK' || !data.routes?.length) {
    throw new Error(
      `Google Directions API error: ${data.status} ${data.error_message ?? ''}`.trim(),
    );
  }

  const routeData = data.routes[0];
  const waypointOrder: number[] = Array.isArray(routeData.waypoint_order)
    ? routeData.waypoint_order
    : [];

  const sortedTasks = waypointOrder.map((index) => tasks[index]);
  const totalMeters = routeData.legs.reduce(
    (sum: number, leg: any) => sum + (leg.distance?.value ?? 0),
    0,
  );
  const totalDistance = totalMeters / 1000;

  return { route: sortedTasks, totalDistance };
};