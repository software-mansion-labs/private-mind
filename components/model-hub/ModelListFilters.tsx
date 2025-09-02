import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import TextFieldInput from '../TextFieldInput';
import SortingTag from './SortingTag';
import { useTheme } from '../../context/ThemeContext';
import { useMemo } from 'react';
import { Theme } from '../../styles/colors';
import SearchIcon from '../../assets/icons/search.svg';
import { ModelHubFilter } from '../../hooks/useModelHubData';
import { ScrollView } from 'react-native-gesture-handler';

interface Props {
  search: string;
  onSearchChange: (search: string) => void;
  activeFilters: Set<ModelHubFilter>;
  onFiltersChange: (filters: Set<ModelHubFilter>) => void;
  groupByModel: boolean;
  onGroupByModelChange: (groupByModel: boolean) => void;
}

const ModelListFilters: React.FC<Props> = ({
  search,
  onSearchChange,
  activeFilters,
  onFiltersChange,
  groupByModel,
  onGroupByModelChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const toggleFilter = (filter: ModelHubFilter) => {
    onFiltersChange(toggleSetElement(new Set(activeFilters), filter));
  };

  return (
    <View style={styles.container}>
      <View style={styles.horizontalInset}>
        <TextFieldInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search Models..."
          icon={
            <SearchIcon
              width={20}
              height={20}
              style={{ color: theme.text.primary }}
            />
          }
        />
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={[styles.tagContainer, styles.horizontalInset]}
        showsHorizontalScrollIndicator={false}
      >
        <SortingTag
          text="Featured"
          selected={activeFilters.has(ModelHubFilter.Featured)}
          onPress={() => toggleFilter(ModelHubFilter.Featured)}
        />
        <SortingTag
          text="Group by model"
          selected={groupByModel}
          onPress={() => onGroupByModelChange(!groupByModel)}
        />
        <SortingTag
          text="Ready to use"
          selected={activeFilters.has(ModelHubFilter.Downloaded)}
          onPress={() => toggleFilter(ModelHubFilter.Downloaded)}
        />
      </ScrollView>
    </View>
  );
};

function toggleSetElement<T>(s: Set<T>, value: T) {
  if (s.has(value)) {
    s.delete(value);
  } else {
    s.add(value);
  }

  return s;
}

export default ModelListFilters;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: 24,
    },
    horizontalInset: {
      paddingHorizontal: 16,
    },
    tagContainer: {
      gap: 8,
      alignItems: 'center',
    },
  });
