/** Ploppable building models by model key. */
import type { ModelFn } from '../types';
import { airport, bus_stop, seaport, train_station } from './transport';
import {
  coal_plant,
  fusion_plant,
  rotor_blades,
  gas_plant,
  microwave_plant,
  nuclear_plant,
  oil_plant,
  solar_plant,
  wind_turbine,
} from './power';
import { desalination, water_pump, water_tower, water_treatment } from './water';
import { incinerator, recycling_center, waste_to_energy } from './garbage';
import { fire_station, police_station } from './safety';
import { clinic, college, hospital, library, museum, school } from './health-education';
import { large_park, marina, playground, plaza, small_park, sports_field, stadium, zoo } from './parks';
import { arcology, casino, city_hall, landmark_tower, mayor_house, prison, statue, toxic_dump } from './rewards';

export const PLOP_MODELS: Record<string, ModelFn> = {
  rotor_blades,
  bus_stop,
  train_station,
  seaport,
  airport,
  coal_plant,
  oil_plant,
  gas_plant,
  nuclear_plant,
  wind_turbine,
  solar_plant,
  microwave_plant,
  fusion_plant,
  water_pump,
  water_tower,
  water_treatment,
  desalination,
  incinerator,
  waste_to_energy,
  recycling_center,
  police_station,
  fire_station,
  clinic,
  hospital,
  school,
  college,
  library,
  museum,
  small_park,
  plaza,
  playground,
  sports_field,
  large_park,
  marina,
  zoo,
  stadium,
  mayor_house,
  city_hall,
  statue,
  landmark_tower,
  arcology,
  casino,
  prison,
  toxic_dump,
};
