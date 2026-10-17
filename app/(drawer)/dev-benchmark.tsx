import React from 'react';
import { Redirect } from 'expo-router';
import { DEV_TOOLS } from '../../constants/dev-tools';
import { DevBenchmarkScreen } from '../../components/devBenchmark/DevBenchmarkScreen';

const DevBenchmarkRoute = () =>
  DEV_TOOLS ? <DevBenchmarkScreen /> : <Redirect href="/" />;

export default DevBenchmarkRoute;
