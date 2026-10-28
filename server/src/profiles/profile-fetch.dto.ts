import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PROFILE_FILTER_FIELDS, PROFILE_FILTER_OPERATORS, ProfileFetchRequest, ProfileFilter, ProfileFilterRule } from '../configuration';

class ProfileFilterRuleDto implements ProfileFilterRule {
  @IsInt() id: number;
  @IsIn([...PROFILE_FILTER_FIELDS]) field: ProfileFilterRule['field'];
  @IsIn([...PROFILE_FILTER_OPERATORS]) operator: ProfileFilterRule['operator'];
  @IsString() @MaxLength(2000) value = '';
}
class ProfileFilterDto implements ProfileFilter {
  @IsIn(['and', 'or']) junction: 'and' | 'or' = 'and';
  @IsArray() @ArrayMaxSize(30) @ValidateNested({each: true}) @Type(() => ProfileFilterRuleDto) rules: ProfileFilterRuleDto[] = [];
}
export class FetchProfilesDto implements ProfileFetchRequest {
  @ValidateNested() @Type(() => ProfileFilterDto) filter: ProfileFilterDto = new ProfileFilterDto();
  @IsInt() @Min(0) @Max(1000000) pageIndex = 0;
  @IsInt() @Min(1) @Max(100) pageSize = 25;
}
export class DuplicateProfileDto {
  @IsOptional() @IsInt() @Min(1) revision?: number;
}
