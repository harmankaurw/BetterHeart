import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import WelcomePage from '../components/better-heart/WelcomePage';
import PersonalInfoForm from '../components/better-heart/PersonalInfoForm';
import BodyMetricsForm from '../components/better-heart/BodyMetricsForm';
import MedicalHistoryForm from '../components/better-heart/MedicalHistoryForm';
import ResultsSummary from '../components/better-heart/ResultsSummary';
import ResourcesPage from '../components/better-heart/ResourcesPage';
import ProgressBar from '../components/better-heart/ProgressBar';

export default function BetterHeart() {
  const [currentPage, setCurrentPage] = useState(0);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    ethnicity: '',
    gender: '',
    familyHistory: false,
    familyHistoryDetails: '',
    diabetes: false,
    hypertension: false,
    dyslipidemia: false
  });
  
  const [results, setResults] = useState({
    bmi: null,
    bmiCategory: '',
    riskLevel: '',
    sleepApneaRisk: '',
    heartAttackRisk: ''
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser && !formData.name) {
        setFormData(prev => ({
          ...prev,
          name: currentUser.full_name || ''
        }));
      }
    } catch (error) {
      // User not logged in, that's fine
    }
  };

  const saveAssessmentMutation = useMutation({
    mutationFn: async (assessmentData) => {
      return await base44.entities.HealthAssessment.create(assessmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['health-assessments']);
      toast.success('Assessment saved successfully!');
    },
    onError: (error) => {
      console.error('Error saving assessment:', error);
      toast.error('Failed to save assessment');
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateBMI = (weight, height) => {
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMICategory = (bmiValue) => {
    if (bmiValue < 18.5) return 'Underweight';
    if (bmiValue < 25) return 'Normal weight';
    if (bmiValue < 30) return 'Overweight';
    return 'Obese';
  };

  const assessCVRisk = (bmiValue) => {
    let score = 0;
    if (formData.familyHistory) score += 1;
    if (formData.diabetes) score += 1;
    if (formData.hypertension) score += 1;
    if (formData.dyslipidemia) score += 1;
    if (bmiValue >= 30) score += 1;
    if (formData.age >= 65) score += 1;
    return score === 0 ? 'Low' : score <= 2 ? 'Moderate' : 'High';
  };

  const assessSleepApnea = (bmiValue) => {
    let score = 0;
    if (bmiValue >= 35) score += 3;
    else if (bmiValue >= 30) score += 2;
    else if (bmiValue >= 25) score += 1;
    if (formData.age >= 50) score += 1;
    if (formData.gender === 'Male') score += 1;
    if (formData.hypertension) score += 2;
    return score <= 3 ? 'Low' : score <= 7 ? 'Moderate' : 'High';
  };

  const assessHeartAttackRisk = (bmiValue) => {
    let score = 0;
    if (formData.age >= 65) score += 3;
    else if (formData.age >= 55) score += 2;
    else if (formData.age >= 45) score += 1;
    if (formData.gender === 'Male' && formData.age >= 45) score += 1;
    if (formData.gender === 'Female' && formData.age >= 55) score += 1;
    if (bmiValue >= 30) score += 2;
    else if (bmiValue >= 25) score += 1;
    if (formData.familyHistory) score += 3;
    if (formData.diabetes) score += 2;
    if (formData.hypertension) score += 2;
    if (formData.dyslipidemia) score += 2;
    return score <= 4 ? 'Low' : score <= 9 ? 'Moderate' : 'High';
  };

  const canProceed = () => {
    if (currentPage === 1) {
      return formData.name.trim() && formData.age && formData.gender;
    }
    if (currentPage === 2) {
      return formData.height && formData.weight && 
             parseFloat(formData.height) > 0 && parseFloat(formData.weight) > 0;
    }
    return true;
  };

  const nextPage = () => {
    if (!canProceed()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (currentPage === 3) {
      // Calculate all results
      const calculatedBMI = parseFloat(calculateBMI(parseFloat(formData.weight), parseFloat(formData.height)));
      const category = getBMICategory(calculatedBMI);
      const cvRisk = assessCVRisk(calculatedBMI);
      const sleepRisk = assessSleepApnea(calculatedBMI);
      const heartRisk = assessHeartAttackRisk(calculatedBMI);
      
      setResults({
        bmi: calculatedBMI,
        bmiCategory: category,
        riskLevel: cvRisk,
        sleepApneaRisk: sleepRisk,
        heartAttackRisk: heartRisk
      });

      // Save to database if user is logged in
      if (user) {
        saveAssessmentMutation.mutate({
          name: formData.name,
          age: parseFloat(formData.age),
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          ethnicity: formData.ethnicity || null,
          gender: formData.gender,
          family_history: formData.familyHistory,
          family_history_details: formData.familyHistoryDetails || null,
          diabetes: formData.diabetes,
          hypertension: formData.hypertension,
          dyslipidemia: formData.dyslipidemia,
          bmi: calculatedBMI,
          bmi_category: category,
          cv_risk_level: cvRisk,
          sleep_apnea_risk: sleepRisk,
          heart_attack_risk: heartRisk,
          assessment_date: new Date().toISOString()
        });
      }
    }
    
    setCurrentPage(prev => prev + 1);
  };

  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 0));

  const handleReset = () => {
    setCurrentPage(0);
    setFormData({
      name: user?.full_name || '',
      age: '',
      height: '',
      weight: '',
      ethnicity: '',
      gender: '',
      familyHistory: false,
      familyHistoryDetails: '',
      diabetes: false,
      hypertension: false,
      dyslipidemia: false
    });
    setResults({
      bmi: null,
      bmiCategory: '',
      riskLevel: '',
      sleepApneaRisk: '',
      heartAttackRisk: ''
    });
  };

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const pages = [
    { component: WelcomePage, props: {} },
    { component: PersonalInfoForm, props: { formData, handleChange } },
    { component: BodyMetricsForm, props: { formData, handleChange } },
    { component: MedicalHistoryForm, props: { formData, handleChange } },
    { component: ResultsSummary, props: { formData, results } },
    { component: ResourcesPage, props: {} }
  ];

  const CurrentPageComponent = pages[currentPage].component;
  const currentProps = pages[currentPage].props;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 mb-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 md:w-10 md:h-10 text-rose-500" />
              <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                Better Heart
              </h1>
            </div>
            {currentPage === 5 && (
              <Button
                onClick={handleReset}
                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700"
              >
                Start New Assessment
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          {currentPage > 0 && currentPage < 5 && (
            <ProgressBar currentStep={currentPage} totalSteps={4} />
          )}

          {/* Page Content */}
          <div className="mb-8 min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                <CurrentPageComponent {...currentProps} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t-2 border-gray-100">
            {currentPage > 0 && currentPage < 5 && (
              <Button
                onClick={prevPage}
                variant="outline"
                className="gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </Button>
            )}

            {currentPage === 0 && (
              <Button
                onClick={nextPage}
                className="ml-auto gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 px-8 py-6 text-lg"
              >
                Begin Assessment
                <ChevronRight className="w-6 h-6" />
              </Button>
            )}

            {currentPage > 0 && currentPage < 4 && (
              <Button
                onClick={nextPage}
                disabled={!canProceed()}
                className="ml-auto gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}

            {currentPage === 4 && (
              <Button
                onClick={nextPage}
                className="ml-auto gap-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
              >
                View Resources
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </motion.div>

        <div className="text-center text-sm text-gray-500">
          <p>© 2025 Better Heart - To Live Better, To Love Better</p>
        </div>
      </div>
    </div>
  );
}