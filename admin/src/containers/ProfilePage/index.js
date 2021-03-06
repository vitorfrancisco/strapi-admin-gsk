import React, { useMemo } from 'react';
import { BackHeader, BaselineAlignment, auth } from 'strapi-helper-plugin';
import { useHistory } from 'react-router-dom';
import { get } from 'lodash';
import ContainerFluid from '../../components/ContainerFluid';
import FormBloc from '../../components/FormBloc';
import SizedInput from '../../components/SizedInput';
import { Header } from '../../components/Settings';
import { useSettingsForm } from '../../hooks';
import { form, schema } from './utils';

const ProfilePage = () => {
  const { goBack } = useHistory();
  const onSubmitSuccessCb = data => data;

  const [
    { formErrors, initialData, isLoading, modifiedData, showHeaderLoader, showHeaderButtonLoader },
    // eslint-disable-next-line no-unused-vars
    dispatch,
    { handleCancel, handleChange, handleSubmit },
  ] = useSettingsForm('/admin/users/me', schema, onSubmitSuccessCb, [
    'email',
    'firstname',
    'lastname',
    'username',
  ]);

  const headerLabel = useMemo(() => {
    const userInfos = onSubmitSuccessCb();

    if (modifiedData) {
      return modifiedData.username || `${modifiedData.firstname} ${modifiedData.lastname}`;
    }

    return userInfos.username || `${userInfos.firstname} ${userInfos.lastname}`;
  }, [modifiedData]);

  return (
    <>
      <BackHeader onClick={goBack} />
      <form onSubmit={handleSubmit}>
        <ContainerFluid>
          <Header
            isLoading={showHeaderLoader}
            initialData={initialData}
            label={headerLabel}
            modifiedData={modifiedData}
            onCancel={handleCancel}
            showHeaderButtonLoader={showHeaderButtonLoader}
          />
          <BaselineAlignment top size="3px" />
          <FormBloc isLoading={isLoading}>
            {Object.keys(form).map(key => {
              return (
                <SizedInput
                  {...form[key]}
                  key={key}
                  error={formErrors[key]}
                  name={key}
                  onChange={handleChange}
                  value={get(modifiedData, key, '')}
                />
              );
            })}
          </FormBloc>
        </ContainerFluid>
      </form>
    </>
  );
};

export default ProfilePage;
